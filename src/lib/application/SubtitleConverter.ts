/** SubtitleConverter — converts subtitle content between SRT/VTT/TXT/JSON, persisting a job. */

import { convertSubtitles, type SubtitleFormat } from "@/lib/utils/subtitles";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";

export const SubtitleConverter = {
  async run(opts: { content: string; to: SubtitleFormat }): Promise<{ result: string; jobId: string }> {
    const job = await JobRepository.create({
      kind: "convert",
      status: "running",
      progress: 30,
      inputText: opts.content,
      model: "subtitle-converter",
      modelReason: "Pure-function converter (no model required).",
    });
    try {
      const result = convertSubtitles(opts.content, opts.to);
      await JobRepository.update(job.id, {
        status: "completed",
        progress: 100,
        outputText: result,
      });
      return { result, jobId: job.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Conversion failed.";
      await JobRepository.update(job.id, { status: "failed", error: message });
      throw err;
    }
  },
};
