/** AudioConverter — converts audio files between formats using ffmpeg. */

import { convertAudio } from "@/lib/utils/ffmpeg";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import { saveOutput } from "@/lib/infrastructure/storage/file-storage";
import path from "path";

export interface AudioConversionRequest {
  inputPath: string;
  inputName: string;
  targetFormat: string;
  bitrate?: string;
  sampleRate?: number;
}

const CODEC_MAP: Record<string, { codec?: string; ext: string }> = {
  mp3: { codec: "libmp3lame", ext: "mp3" },
  wav: { ext: "wav" },
  aac: { codec: "aac", ext: "m4a" },
  m4a: { codec: "aac", ext: "m4a" },
  flac: { codec: "flac", ext: "flac" },
  ogg: { codec: "libvorbis", ext: "ogg" },
  opus: { codec: "libopus", ext: "opus" },
};

export const AudioConverter = {
  async run(request: AudioConversionRequest): Promise<{ outputPath: string; jobId: string }> {
    const spec = CODEC_MAP[request.targetFormat.toLowerCase()];
    if (!spec) throw new Error(`Unsupported target format: ${request.targetFormat}`);

    const job = await JobRepository.create({
      kind: "convert",
      status: "running",
      progress: 20,
      sourceLang: "auto",
      targetLang: "auto",
      inputName: request.inputName,
      inputPath: request.inputPath,
      model: "ffmpeg",
      modelReason: "ffmpeg audio transcode (no model required).",
    });


    try {
      const baseName = path.parse(request.inputName).name;
      const outName = `${baseName}.${spec.ext}`;
      const tmpPath = path.join(process.cwd(), "storage", "workspace", job.id, outName);
      const { ensureDir } = await import("@/lib/utils/ffmpeg");
      await ensureDir(path.dirname(tmpPath));
      await convertAudio(request.inputPath, tmpPath, {
        codec: spec.codec,
        bitrate: request.bitrate,
        sampleRate: request.sampleRate,
      });
      const fs = await import("node:fs/promises");
      const buf = await fs.readFile(tmpPath);
      const finalPath = await saveOutput(job.id, outName, buf);
      await JobRepository.update(job.id, {
        status: "completed",
        progress: 100,
        outputAudio: finalPath,
      });
      return { outputPath: finalPath, jobId: job.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Audio conversion failed.";
      await JobRepository.update(job.id, { status: "failed", error: message });
      throw err;
    }
  },
};
