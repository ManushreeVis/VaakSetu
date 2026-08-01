/**
 * ffmpeg / ffprobe helpers for media processing.
 *  - probe media duration + codec info
 *  - extract a WAV audio track from any video/audio container (for ASR)
 *  - convert audio between formats (format-conversion feature)
 *  - burn subtitle file into a video (burned-in captions)
 */

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg failed (exit ${code}): ${stderr}`)),
    );
  });

export interface MediaProbe {
  durationSec: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

export const probeMedia = async (filePath: string): Promise<MediaProbe> => {
  const args = ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", filePath];
  const result = await new Promise<string>((resolve, reject) => {
    const proc = spawn("ffprobe", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`ffprobe failed: ${stderr}`)),
    );
  });
  const parsed = JSON.parse(result);
  const durationSec = parseFloat(parsed?.format?.duration ?? "0") || 0;
  const streams: { codec_type?: string }[] = parsed?.streams ?? [];
  return {
    durationSec,
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    hasVideo: streams.some((s) => s.codec_type === "video"),
  };
};

/** Extract a 16kHz mono WAV audio track suitable for ASR. */
export const extractAudioForAsr = async (filePath: string, outPath: string): Promise<string> => {
  await runFfmpeg(["-i", filePath, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", outPath]);
  return outPath;
};

/** Convert an audio file to a target format/codec. */
export const convertAudio = async (
  inPath: string,
  outPath: string,
  opts: { codec?: string; bitrate?: string; sampleRate?: number } = {},
): Promise<string> => {
  const args = ["-i", inPath];
  if (opts.codec) args.push("-c:a", opts.codec);
  if (opts.bitrate) args.push("-b:a", opts.bitrate);
  if (opts.sampleRate) args.push("-ar", String(opts.sampleRate));
  args.push(outPath);
  await runFfmpeg(args);
  return outPath;
};

/** Burn an SRT subtitle file into a video (hardcoded captions). Returns the new video path. */
export const burnSubtitlesIntoVideo = async (
  videoPath: string,
  srtPath: string,
  outPath: string,
  style = "FontSize=12,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BorderStyle=1,Outline=2,Shadow=1",
): Promise<string> => {
  // Escape path for the subtitles filter (Windows-style colons need escaping on some systems).
  const escaped = srtPath.replace(/'/g, "\\'").replace(/:/g, "\\:");
  await runFfmpeg([
    "-i", videoPath,
    "-vf", `subtitles='${escaped}':force_style='${style}'`,
    "-c:a", "copy",
    outPath,
  ]);
  return outPath;
};

export const ensureDir = async (dir: string) => fs.mkdir(dir, { recursive: true });

export const withExtension = (filePath: string, ext: string): string => {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}.${ext.replace(/^\./, "")}`);
};
