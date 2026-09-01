/**
 * VideoDubber — merges a video with translated neural speech audio.
 *
 * Produces an MP4 video where the audio track is either replaced with
 * the translated voice track or mixed with original audio ducking.
 */

import path from "path";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import { saveOutput, fileExists } from "@/lib/infrastructure/storage/file-storage";
import { dubVideo, ensureDir } from "@/lib/utils/ffmpeg";

export interface DubResult {
  outputPath: string;
  downloadName: string;
  jobId: string;
}

export const VideoDubber = {
  async run(jobId: string, duckOriginal: boolean = false): Promise<DubResult> {
    const job = await JobRepository.getById(jobId);
    if (!job) throw new Error("Job not found.");
    if (job.kind !== "media") throw new Error("Dubbing is only available for media translation jobs.");
    if (!job.outputAudio) throw new Error("This job has no translated audio to dub. Re-run with voice generation enabled.");
    if (!job.inputPath) throw new Error("Source video file is no longer available.");

    const sourceExists = await fileExists(job.inputPath);
    if (!sourceExists) throw new Error("Source media file has been removed from storage.");

    const audioExists = await fileExists(job.outputAudio);
    if (!audioExists) throw new Error("Translated audio file has been removed from storage.");

    const workspaceDir = path.join(process.cwd(), "storage", "workspace", `dub-${jobId}`);
    await ensureDir(workspaceDir);

    const baseName = path.parse(job.inputName ?? "video").name;
    const modeSuffix = duckOriginal ? "mixed" : "dubbed";
    const outName = `${baseName}.${job.targetLang}.${modeSuffix}.mp4`;
    const tmpOut = path.join(workspaceDir, outName);

    try {
      await dubVideo(job.inputPath, job.outputAudio, tmpOut, duckOriginal);
      const fs = await import("node:fs/promises");
      const buf = await fs.readFile(tmpOut);
      const finalPath = await saveOutput(jobId, outName, buf);
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
      return { outputPath: finalPath, downloadName: outName, jobId };
    } catch (err) {
      const fs = await import("node:fs/promises");
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  },
};
