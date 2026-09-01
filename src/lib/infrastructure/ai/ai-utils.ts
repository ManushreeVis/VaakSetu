/**
 * ai-utils.ts — Shared utilities for VaakSetu AI adapter implementations.
 *
 * Centralizes functions previously duplicated across gemini-adapter.ts and
 * bhashini-adapter.ts. Import from here in all adapter files.
 */

import type { TranscriptionSegment } from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// Segment Building
// ---------------------------------------------------------------------------

/**
 * Build synthetic timestamp segments from a plain text string.
 * Used when the underlying engine returns only text (no timestamps),
 * e.g. Bhashini API or Gemini transcription fallbacks.
 *
 * Segments are split at sentence boundaries (Devanagari danda + Latin punctuation),
 * then grouped into chunks ≤ 84 chars for readable subtitle display.
 * Timestamps are proportional to character length.
 */
export const buildSegments = (
  text: string,
  durationSec?: number,
): TranscriptionSegment[] => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const sentences = clean
    .split(/(?<=[।.!?])\s+|(?<=।)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length > 84 && buf) {
      chunks.push(buf.trim());
      buf = s;
    } else {
      buf = (buf ? buf + " " : "") + s;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());

  const total =
    durationSec && durationSec > 0 ? durationSec : Math.max(6, chunks.length * 4);
  const charTotal = chunks.reduce((a, c) => a + c.length, 0) || 1;
  let cursor = 0;

  return chunks.map((c) => {
    const dur = Math.max(1.2, (c.length / charTotal) * total);
    const seg: TranscriptionSegment = { start: cursor, end: cursor + dur, text: c };
    cursor += dur;
    return seg;
  });
};

// ---------------------------------------------------------------------------
// TTS Helpers
// ---------------------------------------------------------------------------

/**
 * Split a long text into TTS-friendly chunks of at most `maxLen` characters.
 * Splits on sentence boundaries (Devanagari danda, Latin punctuation) to avoid
 * breaking synthesized speech mid-sentence.
 */
export const splitTextForTts = (text: string, maxLen = 190): string[] => {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[।.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current = (current ? current + " " : "") + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
};

/**
 * Detect the TTS language code from the requested language string,
 * with Unicode script-range fallback for Devanagari.
 *
 * Returns a simple BCP-47 base tag: "mr" | "hi" | "en" | ...
 */
export const detectTtsLang = (text: string, requestedLang?: string): string => {
  const norm = (requestedLang ?? "").trim().toLowerCase();

  if (norm === "mr" || norm.startsWith("mr") || norm.includes("marathi")) return "mr";
  if (norm === "hi" || norm.startsWith("hi") || norm.includes("hindi")) return "hi";
  if (norm === "en" || norm.startsWith("en") || norm.includes("english")) return "en";
  if (norm === "bn" || norm.startsWith("bn")) return "bn";
  if (norm === "gu" || norm.startsWith("gu")) return "gu";
  if (norm === "ta" || norm.startsWith("ta")) return "ta";
  if (norm === "te" || norm.startsWith("te")) return "te";
  if (norm === "kn" || norm.startsWith("kn")) return "kn";
  if (norm === "ml" || norm.startsWith("ml")) return "ml";

  // Script inspection: Devanagari block covers Hindi and Marathi
  if (/[\u0900-\u097F]/.test(text)) return "hi";

  return "en";
};

// ---------------------------------------------------------------------------
// Audio Utilities
// ---------------------------------------------------------------------------

/**
 * Generate a silent WAV file buffer of the specified duration.
 * Used as a last-resort TTS fallback when all synthesis engines fail.
 */
export const createSilentWavBuffer = (durationSec: number): Buffer => {
  const sampleRate = 22050;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);            // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
};
