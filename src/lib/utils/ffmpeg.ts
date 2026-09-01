/**
 * ffmpeg / ffprobe helpers for media processing.
 *  - probe media duration + codec info
 *  - extract a WAV audio track from any video/audio container (for ASR)
 *  - convert audio between formats (format-conversion feature)
 *  - burn subtitle file into a video (burned-in captions)
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

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

/** Extract a 16kHz mono WAV audio track with vocal enhancement & loudness normalization for ASR. */
export const extractAudioForAsr = async (filePath: string, outPath: string): Promise<string> => {
  await runFfmpeg([
    "-i", filePath,
    "-vn",
    "-af", "highpass=f=80,lowpass=f=7500,volume=1.5,loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ac", "1",
    "-ar", "16000",
    "-f", "wav",
    outPath,
  ]);
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
  // Cross-platform path escaping for the ffmpeg `subtitles` filter.
  //
  // The subtitles filter uses libass which requires:
  //  - Forward slashes (even on Windows — ffmpeg handles this)
  //  - Windows drive colons escaped as "\:" (e.g. "C\:/path/to/file.srt")
  //  - Single quotes escaped as "\'" (shell-level quoting)
  //  - Square brackets escaped as "\[" "\]" (libass filter graph special chars)
  //
  // NOTE: We use path.resolve() to ensure absolute path before escaping.
  const absPath = path.resolve(srtPath);
  const escaped = absPath
    .replace(/\\/g, "/")               // Windows backslashes → forward slashes
    .replace(/^([A-Za-z]):/, "$1\\:")   // Escape Windows drive letter colon: C: → C\:
    .replace(/'/g, "\\'")              // Single quote
    .replace(/\[/g, "\\[")             // Square bracket open
    .replace(/\]/g, "\\]");            // Square bracket close

  await runFfmpeg([
    "-i", videoPath,
    "-vf", `subtitles='${escaped}':force_style='${style}'`,
    "-c:a", "copy",
    outPath,
  ]);
  return outPath;
};

/** Dub video with a translated audio track (replace audio or duck original). */
export const dubVideo = async (
  videoPath: string,
  audioPath: string,
  outPath: string,
  duckOriginal = false,
): Promise<string> => {
  if (duckOriginal) {
    await runFfmpeg([
      "-i", videoPath,
      "-i", audioPath,
      "-filter_complex", "[0:a]volume=0.15[a0];[1:a]volume=1.0[a1];[a0][a1]amix=inputs=2:duration=longest[aout]",
      "-map", "0:v:0",
      "-map", "[aout]",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-shortest",
      outPath,
    ]);
  } else {
    await runFfmpeg([
      "-i", videoPath,
      "-i", audioPath,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      outPath,
    ]);
  }
  return outPath;
};

export const ensureDir = async (dir: string) => fs.mkdir(dir, { recursive: true });

export const withExtension = (filePath: string, ext: string): string => {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}.${ext.replace(/^\./, "")}`);
};

