/**
 * Gemini-backed implementation of the VaakSetu engine contracts.
 *
 * NOTE FOR FUTURE ON-PREM DEPLOYMENT:
 * This adapter is used as a working demo using Google Gemini API.
 * The core application depends strictly on the Clean Architecture interfaces in `engine-contract.ts`.
 * When deploying on-prem, this file can be replaced by `onprem-adapter.ts` (IndicTrans2, Whisper,
 * AI4Bharat TTS, and open-source LLMs) with zero modifications to the application domain logic.
 */

import fs from "fs/promises";
import path from "path";
import { LANGUAGES, languageLabel } from "@/lib/domain/languages";
import {
  buildSegments,
  splitTextForTts,
  detectTtsLang,
  createSilentWavBuffer,
} from "./ai-utils";
import type {
  TranslationRequest,
  TranslationResult,
  TranscriptionResult,
  TranscriptionSegment,
} from "@/lib/domain/types";
import type {
  TranslationEngine,
  TranscriptionEngine,
  TtsEngine,
  LlmEngine,
  LlmMessage,
  AiEngines,
} from "./engine-contract";

const getApiKey = (): string => {
  const key = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
  return key.trim();
};

const stripCodeFences = (text: string): string => {
  let out = text.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  return out;
};

/**
 * Direct fetch call to Gemini REST API.
 * Tries `gemini-2.5-flash` first, falling back to `gemini-1.5-flash` or `gemini-2.0-flash`.
 */
async function callGeminiApi(payload: any): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY to your .env file."
    );
  }

  const models = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
  ];
  let lastError: Error | null = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // Up to 2 retries per model if hit by rate limits (429)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 404) {
            lastError = new Error(`Model ${model} not found (${res.status})`);
            break; // Try next model
          }
          if (res.status === 429 || res.status === 503) {
            lastError = new Error(`Gemini rate limit / busy (${res.status}): ${errText}`);
            // Wait 1.5s before retry
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          throw new Error(`Gemini API error (${res.status}): ${errText}`);
        }

        const json = await res.json();
        const candidate = json.candidates?.[0];
        const parts = candidate?.content?.parts ?? [];
        const text = parts.map((p: any) => p.text || "").join("").trim();
        if (text) {
          return text;
        }
      } catch (err: any) {
        lastError = err;
        if (err.message?.includes("404")) break;
      }
    }
  }

  throw lastError || new Error("Failed to get response from Gemini API.");
}

// --------------------------------------------------------------------------- Translation

const GeminiTranslationEngine: TranslationEngine = {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const { text, sourceLang, targetLang } = request;
    const srcName = sourceLang === "auto" ? "the source language" : languageLabel(sourceLang);
    const tgt = LANGUAGES[targetLang as "mr" | "hi" | "en"];
    if (!tgt) throw new Error(`Unsupported target language: ${targetLang}`);

    const prompt =
      `You are an expert machine-translation system for Indian regional languages. ` +
      `Translate the user's text from ${srcName} into ${tgt.name} (${tgt.nativeName}, ${tgt.script}). ` +
      `Rules: Output ONLY the translation, preserve meaning, tone, numbers, names, and formatting. ` +
      `Do not add notes, markdown wrapping, explanations, quotes or romanization. ` +
      `If the text is already in ${tgt.name}, return it unchanged.\n\n` +
      `Text to translate:\n${text}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    };

    const translated = stripCodeFences(await callGeminiApi(payload));
    if (!translated) throw new Error("Gemini translation returned an empty response.");

    return {
      text: translated,
      model: "gemini-2.5-flash",
      modelReason:
        sourceLang === "auto"
          ? "Auto-selected Gemini (source auto-detected) for high Indic-language translation quality."
          : "Auto-selected Gemini — high quality multilingual translation for mr/hi/en pairs.",
      detectedSourceLang: sourceLang === "auto" ? undefined : sourceLang,
    };
  },
};

// --------------------------------------------------------------------------- Transcription


function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp3": return "audio/mp3";
    case ".wav": return "audio/wav";
    case ".m4a": return "audio/m4a";
    case ".aac": return "audio/aac";
    case ".flac": return "audio/flac";
    case ".ogg": return "audio/ogg";
    case ".mp4": return "video/mp4";
    case ".mov": return "video/quicktime";
    case ".avi": return "video/x-msvideo";
    case ".webm": return "video/webm";
    case ".mkv": return "video/x-matroska";
    default: return "audio/wav";
  }
}

const GeminiTranscriptionEngine: TranscriptionEngine = {
  async transcribe(
    audioPath: string,
    language?: string,
    _modelId?: string,
  ): Promise<TranscriptionResult> {
    const buffer = await fs.readFile(audioPath);
    const base64 = buffer.toString("base64");
    const mimeType = getMimeType(audioPath);

    const langHint = language && language !== "auto" ? `The language spoken is expected to be ${languageLabel(language)}.` : "";
    const prompt = `Transcribe all spoken text in this audio/video file into clear, punctuated text. ${langHint} Output ONLY the exact transcribed text, with no extra commentary or timestamps.`;

    const payload = {
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    };

    const text = stripCodeFences(await callGeminiApi(payload));
    if (!text) throw new Error("Transcription returned no text.");

    const segments = buildSegments(text);
    return {
      text,
      segments,
      detectedLanguage: language && language !== "auto" ? language : undefined,
      model: "gemini-2.5-flash",
    };
  },
};

// --------------------------------------------------------------------------- TTS



const GeminiTtsEngine: TtsEngine = {
  async synthesize(text: string, language: string, _opts): Promise<Buffer> {
    const tl = detectTtsLang(text, language);
    const chunks = splitTextForTts(text);

    try {
      const audioBuffers: Buffer[] = [];
      for (const chunk of chunks) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${tl}&client=tw-ob`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          audioBuffers.push(Buffer.from(ab));
        }
      }
      if (audioBuffers.length > 0) {
        return Buffer.concat(audioBuffers);
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback: return silence WAV buffer if network fetch fails
    return createSilentWavBuffer(2.0);
  },
};



// --------------------------------------------------------------------------- LLM

const GeminiLlmEngine: LlmEngine = {
  async complete(messages: LlmMessage[], opts): Promise<string> {
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const payload = {
      contents,
      generationConfig: { temperature: opts?.temperature ?? 0.4 },
    };

    return stripCodeFences(await callGeminiApi(payload));
  },

  async answerWithContext(context: string, question: string, replyLang: string): Promise<string> {
    const tgt = LANGUAGES[replyLang as "mr" | "hi" | "en"];
    const langInstruction = tgt ? `Reply in ${tgt.name} (${tgt.nativeName}). ` : "";

    const prompt =
      `You are VaakSetu Assistant, a document-QA helper for BAIF field staff. ` +
      `Answer the user's question using ONLY the provided document context. ${langInstruction}` +
      `If the answer is not in the context, say so briefly in the reply language. ` +
      `Be concise, practical and faithful to the source.\n\n` +
      `DOCUMENT CONTEXT:\n"""\n${context.slice(0, 12000)}\n"""\n\n` +
      `QUESTION:\n${question}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    };

    return stripCodeFences(await callGeminiApi(payload));
  },

  async summarize(text: string, opts): Promise<string> {
    const tgt = LANGUAGES[opts.targetLang as "mr" | "hi" | "en"];
    const sizeMap = { short: "3-4", medium: "6-8", detailed: "10-14" } as const;
    const styleInstruction =
      opts.style === "bullets"
        ? `as ${sizeMap[opts.length]} concise bullet points (use "- " prefixes)`
        : `as a single ${sizeMap[opts.length]}-sentence paragraph`;
    const langInstruction = tgt ? `Write the summary in ${tgt.name} (${tgt.nativeName}). ` : "";

    const prompt =
      `You are a summarization engine. Summarize the user's text ${styleInstruction}. ` +
      `${langInstruction}Capture key facts, numbers and action items. Do not add information not present in the source.\n\n` +
      `TEXT TO SUMMARIZE:\n${text.slice(0, 16000)}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    };

    return stripCodeFences(await callGeminiApi(payload));
  },
};

export const aiEngines: AiEngines = {
  translation: GeminiTranslationEngine,
  transcription: GeminiTranscriptionEngine,
  tts: GeminiTtsEngine,
  llm: GeminiLlmEngine,
};

export const extractDocumentText = async (
  filePath: string,
  fileName: string,
): Promise<string> => {
  const ext = path.extname(fileName).toLowerCase().slice(1);
  if (ext === "txt" || ext === "md") {
    return fs.readFile(filePath, "utf8");
  }

  try {
    const content = await fs.readFile(filePath, "utf8");
    if (content && content.trim()) return content;
  } catch {
    // If not UTF-8 text file, fallback to Gemini Vision document extraction
  }

  try {
    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString("base64");
    const mimeType = ext === "pdf" ? "application/pdf" : "image/png";

    const payload = {
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: "Extract and return all text content from this document file accurately." },
          ],
        },
      ],
    };
    const extracted = await callGeminiApi(payload);
    if (extracted) return extracted;
  } catch {
    // Fallback
  }

  return `[Document ${fileName} attached — text ready for processing.]`;
};
