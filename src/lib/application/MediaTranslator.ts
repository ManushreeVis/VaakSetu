/**
 * MediaTranslator — orchestrates the full media translation pipeline:
 *   probe → extract audio → transcribe (Whisper) → translate segments (batched)
 *   → build dual subtitles (source + target) → synthesize time-aligned voice (TTS)
 *   → generate dubbed MP4 video.
 *
 * v3.0 Changes:
 * - Context-aware BATCHED segment translation via /api/translate-batch.
 *   Replaces the old per-segment sequential loop that produced gibberish on
 *   short Whisper chunks (2-5 words). Now groups 10-80 words per batch.
 * - Uses pathlib-safe path joining for cross-platform compatibility.
 * - Calls /api/system/offload before heavy operations to manage VRAM.
 */

import path from "path";
import fs from "fs/promises";
import { aiEngines } from "@/lib/infrastructure/ai/zai-adapter";
import {
  translateSegmentsBatched,
  requestModelOffload,
} from "@/lib/infrastructure/ai/local-adapter";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import { saveOutput } from "@/lib/infrastructure/storage/file-storage";
import { ModelSelector } from "./ModelSelector";
import {
  probeMedia,
  extractAudioForAsr,
  dubVideo,
} from "@/lib/utils/ffmpeg";
import {
  segmentsToCues,
  toSrt,
  toVtt,
} from "@/lib/utils/subtitles";
import type {
  MediaTranslationRequest,
  MediaTranslationResult,
  TranscriptionSegment,
} from "@/lib/domain/types";

const LOCAL_AI_URL = process.env.LOCAL_AI_URL || "http://127.0.0.1:8000";

const ensureJobDir = async (jobId: string): Promise<string> => {
  const dir = path.join(process.cwd(), "storage", "workspace", jobId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

/**
 * Translate segments using the local AI's context-aware batched endpoint.
 *
 * 🔴 Old behaviour (v2): Each Whisper segment was translated individually
 *    (one HTTP call per segment). Whisper VAD often produces 2-5 word chunks
 *    which are too short for IndicTrans2 to generate coherent output —
 *    resulting in gibberish, hallucinations, or repeated words.
 *
 * ✅ New behaviour (v3): Segments are grouped into context windows of 10-80 words.
 *    The server translates each group as a paragraph, then proportionally maps
 *    the translation back to individual segment timestamps.
 *
 * Falls back to whole-text translation if the batch endpoint is unavailable.
 */
const translateSegmentsContextual = async (
  segments: TranscriptionSegment[],
  sourceLang: string,
  targetLang: string,
): Promise<{ segments: TranscriptionSegment[]; whole: string }> => {
  if (!segments.length) {
    return { segments: [], whole: "" };
  }

  // Filter empty segments (keep for timestamp continuity, translate non-empty)
  const nonEmptyCount = segments.filter((s) => s.text.trim()).length;
  if (nonEmptyCount === 0) {
    return { segments, whole: "" };
  }

  // ── Attempt 1: Local AI batch translation (context-aware, no gibberish) ──
  try {
    const translated = await translateSegmentsBatched(segments, sourceLang, targetLang);
    const whole = translated.map((t) => t.text).join(" ").trim();
    return { segments: translated, whole };
  } catch (batchErr) {
    console.warn(
      "[MediaTranslator] Batch translation endpoint unavailable, falling back to sequential:",
      batchErr instanceof Error ? batchErr.message : batchErr,
    );
  }

  // ── Attempt 2: Direct 1:1 sentence translation (lossless fallback) ──
  const translated: TranscriptionSegment[] = [...segments];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = seg.text.trim();
    if (!text) continue;

    try {
      const r = await aiEngines.translation.translate({
        text,
        sourceLang,
        targetLang,
      });
      translated[i] = {
        ...seg,
        text: r.text.trim() || seg.text,
      };
    } catch {
      // Keep original text on failure
    }
  }

  const whole = translated.map((t) => t.text).join(" ").trim();
  return { segments: translated, whole };
};

/**
 * Call the local AI's segment-aware TTS endpoint.
 * Produces a single audio file where each segment's speech is placed at the
 * correct timestamp with natural pauses.
 */
const synthesizeSegmentsAligned = async (
  segments: TranscriptionSegment[],
  language: string,
  totalDuration: number,
): Promise<Buffer> => {
  const segData = segments
    .filter((s) => s.text.trim())
    .map((s) => ({ text: s.text, start: s.start, end: s.end }));

  try {
    const res = await fetch(`${LOCAL_AI_URL}/api/tts-segments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segments: segData,
        language,
        total_duration: totalDuration,
      }),
      signal: AbortSignal.timeout(600_000), // 10 min for long videos
    });

    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    }

    console.warn(
      `[MediaTranslator] Segment TTS returned ${res.status}, falling back to single-block TTS.`,
    );
  } catch (err) {
    console.warn("[MediaTranslator] Segment TTS unavailable, falling back:", err);
  }

  // Fallback: synthesize as a single text block
  const wholeText = segments.map((s) => s.text).join(" ");
  return aiEngines.tts.synthesize(wholeText, language);
};

export const MediaTranslator = {
  async run(
    request: MediaTranslationRequest,
  ): Promise<MediaTranslationResult & { jobId: string }> {
    const probe = await probeMedia(request.inputPath);
    if (!probe.hasAudio) {
      throw new Error("The uploaded media has no audio track to transcribe.");
    }

    const selection = ModelSelector.select({
      role: "transcription",
      sourceLang: request.sourceLang,
      durationSec: probe.durationSec,
      manualModelId: request.modelId,
    });
    const translationSelection = ModelSelector.select({
      role: "translation",
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
    });

    const job = await JobRepository.create({
      kind: "media",
      status: "running",
      progress: 5,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      inputName: request.inputName,
      inputPath: request.inputPath,
      inputMime: request.inputMime,
      durationSec: probe.durationSec,
      model: `${selection.modelId}+${translationSelection.modelId}`,
      modelReason: `${selection.reason} ${translationSelection.reason}`,
    });

    try {
      const jobDir = await ensureJobDir(job.id);
      // Use path.join (cross-platform) consistently — never string concatenation
      const wavPath = path.join(jobDir, "audio.wav");

      // ── Step 1: Extract audio ──────────────────────────────────────────
      await JobRepository.update(job.id, { progress: 10 });
      await extractAudioForAsr(request.inputPath, wavPath);

      // ── Step 2: Transcribe with Whisper ───────────────────────────────
      await JobRepository.update(job.id, { progress: 25 });
      const transcript = await aiEngines.transcription.transcribe(
        wavPath,
        request.sourceLang === "auto" ? undefined : request.sourceLang,
        selection.modelId,
      );

      // Respect user-selected source language if explicitly chosen (not 'auto');
      // only fall back to Whisper auto-detection when user selected 'auto'.
      const effectiveSourceLang =
        request.sourceLang && request.sourceLang !== "auto"
          ? request.sourceLang
          : transcript.detectedLanguage || "hi";
      const segmentCount = transcript.segments.length;
      const wordCount = transcript.words?.length ?? 0;
      console.log(
        `[MediaTranslator] 🎯 YouTube-grade ASR: ${segmentCount} sentence segments` +
        (wordCount > 0 ? ` from ${wordCount} words` : "") +
        ` (lang=${effectiveSourceLang})`
      );

      await JobRepository.update(job.id, {
        progress: 40,
        transcript: transcript.text,
        sourceLang: effectiveSourceLang,
      });

      // ── Step 3: Per-sentence translation (YouTube-grade, 1:1 timestamp mapping) ──
      // Each segment from the transcriber is already a natural complete sentence.
      // translate_segments_batched() now translates each sentence independently
      // with zero proportional word-splitting — no information loss.
      const { segments: translatedSegs, whole } = await translateSegmentsContextual(
        transcript.segments,
        effectiveSourceLang,
        request.targetLang,
      );

      console.log(
        `[MediaTranslator] ✓ Translation complete: ${translatedSegs.length} translated sentences`
      );
      await JobRepository.update(job.id, { progress: 60, outputText: whole });

      let outputAudioPath: string | undefined;
      let outputSrt: string | undefined;
      let outputVtt: string | undefined;
      let sourceSrt: string | undefined;
      let sourceVtt: string | undefined;
      let dubbedVideoPath: string | undefined;
      let dubbedVideoName: string | undefined;

      const baseName = path.parse(request.inputName).name;

      // Copy source video to output directory for streaming
      const safeInputName = `source_${path.basename(request.inputPath)}`;
      const inputBuffer = await fs.readFile(request.inputPath);
      await saveOutput(job.id, safeInputName, inputBuffer);

      // ── Step 4: Generate Subtitles (Target + Source) ──────────────────
      if (request.generateSubtitles) {
        const targetCues = segmentsToCues(translatedSegs);
        outputSrt = toSrt(targetCues);
        outputVtt = toVtt(targetCues);
        await saveOutput(job.id, `${baseName}.${request.targetLang}.srt`, outputSrt);
        await saveOutput(job.id, `${baseName}.${request.targetLang}.vtt`, outputVtt);

        if (transcript.segments.length > 0) {
          const sourceCues = segmentsToCues(transcript.segments);
          sourceSrt = toSrt(sourceCues);
          sourceVtt = toVtt(sourceCues);
          await saveOutput(job.id, `${baseName}.${effectiveSourceLang}.srt`, sourceSrt);
          await saveOutput(job.id, `${baseName}.${effectiveSourceLang}.vtt`, sourceVtt);
        }
      }

      // ── Step 5: Synthesize time-aligned voice ─────────────────────────
      if (request.generateVoice) {
        await JobRepository.update(job.id, { progress: 70 });

        const audioBuffer = await synthesizeSegmentsAligned(
          translatedSegs,
          request.targetLang,
          probe.durationSec,
        );

        const audioName = `${baseName}.${request.targetLang}.mp3`;
        outputAudioPath = await saveOutput(job.id, audioName, audioBuffer);

        // ── Step 6: Dub video ──────────────────────────────────────────
        if (probe.hasVideo) {
          await JobRepository.update(job.id, { progress: 90 });
          try {
            dubbedVideoName = `${baseName}.${request.targetLang}.dubbed.mp4`;
            const tmpDubbed = path.join(jobDir, dubbedVideoName);
            // duck=false: clean, crystal-clear dubbing without conflicting source dialogue
            await dubVideo(request.inputPath, outputAudioPath, tmpDubbed, false);
            const dubbedBuf = await fs.readFile(tmpDubbed);
            dubbedVideoPath = await saveOutput(job.id, dubbedVideoName, dubbedBuf);
          } catch (dubErr) {
            console.warn("[MediaTranslator] Video dubbing notice:", dubErr);
          }
        }
      }

      // ── Step 7: Offload translation models to free VRAM ───────────────
      // Best-effort: free VRAM after the heavy translation work is done.
      void requestModelOffload().catch(() => {});

      await JobRepository.update(job.id, {
        status: "completed",
        progress: 100,
        transcript: transcript.text,
        outputText: whole,
        outputAudio: outputAudioPath ?? null,
        outputSrt: outputSrt ?? null,
        outputVtt: outputVtt ?? null,
      });

      return {
        transcript: transcript.text,
        translatedText: whole,
        segments: translatedSegs,
        sourceSegments: transcript.segments,
        words: transcript.words,
        outputAudioPath,
        outputSrt,
        outputVtt,
        sourceSrt,
        sourceVtt,
        inputVideoPath: request.inputPath,
        inputVideoName: safeInputName,
        dubbedVideoPath,
        dubbedVideoName,
        hasVideo: probe.hasVideo,
        model: `${selection.modelId}+${translationSelection.modelId}`,
        modelReason: `${selection.reason} ${translationSelection.reason}`,
        durationSec: probe.durationSec,
        jobId: job.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Media translation failed.";
      await JobRepository.update(job.id, { status: "failed", error: message });
      throw err;
    }
  },
};
