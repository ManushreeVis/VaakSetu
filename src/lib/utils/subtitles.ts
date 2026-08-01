/**
 * Subtitle utilities: parse + serialize SRT, VTT, TXT, JSON.
 * Pure functions, no external deps.
 */

import type { TranscriptionSegment } from "@/lib/domain/types";

interface Cue {
  start: number;
  end: number;
  text: string;
}

const pad = (n: number, len = 2) => String(n).padStart(len, "0");

/** Format seconds as HH:MM:SS,mmm (SRT) or HH:MM:SS.mmm (VTT). */
const formatTimestamp = (sec: number, comma = true): string => {
  const s = Math.max(0, sec);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const totalSec = Math.floor(s);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const sep = comma ? "," : ".";
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${sep}${pad(ms, 3)}`;
};

export const toSrt = (cues: Cue[]): string =>
  cues
    .map((c, i) => `${i + 1}\n${formatTimestamp(c.start)} --> ${formatTimestamp(c.end)}\n${c.text}`)
    .join("\n\n") + "\n";

export const toVtt = (cues: Cue[]): string =>
  "WEBVTT\n\n" +
  cues
    .map((c) => `${formatTimestamp(c.start, false)} --> ${formatTimestamp(c.end, false)}\n${c.text}`)
    .join("\n\n") + "\n";

export const toTxt = (cues: Cue[]): string =>
  cues.map((c) => c.text).join("\n") + "\n";

export const toJson = (cues: Cue[]): string =>
  JSON.stringify(cues, null, 2) + "\n";

/** Parse SRT or VTT content into cues. */
export const parseSubtitles = (content: string): Cue[] => {
  const normalized = content.replace(/\r/g, "");
  const blocks = normalized
    .replace(/^WEBVTT.*\n/, "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const timeLineIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIdx === -1) continue;
    const timeLine = lines[timeLineIdx];
    const match = timeLine.match(/(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/);
    if (!match) continue;
    const start = parseTimestamp(match[1]);
    const end = parseTimestamp(match[2]);
    const text = lines.slice(timeLineIdx + 1).join("\n").trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
};

const parseTimestamp = (ts: string): number => {
  const m = ts.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
  if (!m) return 0;
  return (+m[1] * 3600 + +m[2] * 60 + +m[3]) + +m[4] / 1000;
};

export const segmentsToCues = (segments: TranscriptionSegment[]): Cue[] =>
  segments.map((s) => ({ start: s.start, end: s.end, text: s.text }));

export type SubtitleFormat = "srt" | "vtt" | "txt" | "json";

export const serializeSubtitles = (cues: Cue[], format: SubtitleFormat): string => {
  switch (format) {
    case "srt":
      return toSrt(cues);
    case "vtt":
      return toVtt(cues);
    case "txt":
      return toTxt(cues);
    case "json":
      return toJson(cues);
    default:
      return toSrt(cues);
  }
};

export const convertSubtitles = (content: string, to: SubtitleFormat): string => {
  const cues = parseSubtitles(content);
  if (!cues.length) throw new Error("No subtitle cues found in the input.");
  return serializeSubtitles(cues, to);
};
