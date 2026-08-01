/**
 * CaptionBurner — burns SRT subtitles into a video file (hardcoded captions).
 *
 * Uses ffmpeg's `subtitles` filter. Produces an MP4 with the translated captions
 * permanently rendered on the video — ideal for offline field playback where
 * subtitle-file loading isn't available.
 */

import path from "path";
import fs from "fs/promises";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import { saveOutput, fileExists } from "@/lib/infrastructure/storage/file-storage";
import { burnSubtitlesIntoVideo, ensureDir } from "@/lib/utils/ffmpeg";

export interface BurnResult {
  outputPath: string;
  downloadName: string;
  jobId: string;
}

export const CaptionBurner = {
  async run(jobId: string): Promise<BurnResult> {
    const job = await JobRepository.getById(jobId);
    if (!job) throw new Error("Job not found.");
    if (job.kind !== "media") throw new Error("Burned captions are only available for media translation jobs.");
    if (!job.outputSrt) throw new Error("This job has no SRT subtitles to burn. Re-run with subtitles enabled.");
    if (!job.inputPath) throw new Error("Source video file is no longer available.");

    const sourceExists = await fileExists(job.inputPath);
    if (!sourceExists) throw new Error("Source media file has been removed from storage.");

    // Write the SRT to a temp file (ffmpeg needs a file path, not a string).
    const workspaceDir = path.join(process.cwd(), "storage", "workspace", `burn-${jobId}`);
    await ensureDir(workspaceDir);
    const srtPath = path.join(workspaceDir, `${job.targetLang}.srt`);
    await fs.writeFile(srtPath, job.outputSrt, "utf8");

    const baseName = path.parse(job.inputName ?? "video").name;
    const outName = `${baseName}.${job.targetLang}.burned.mp4`;
    const tmpOut = path.join(workspaceDir, outName);

    try {
      await burnSubtitlesIntoVideo(job.inputPath, srtPath, tmpOut);
      const buf = await fs.readFile(tmpOut);
      const finalPath = await saveOutput(jobId, outName, buf);
      // Cleanup temp files.
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
      return { outputPath: finalPath, downloadName: outName, jobId };
    } catch (err) {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  },
};
