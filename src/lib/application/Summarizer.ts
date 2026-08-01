/** Summarizer — produces a concise summary of text (or an audio transcript) in any target language. */

import { aiEngines } from "@/lib/infrastructure/ai/zai-adapter";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import { ModelSelector } from "./ModelSelector";
import type { SummaryRequest, SummaryResult } from "@/lib/domain/types";

export const Summarizer = {
  async run(request: SummaryRequest): Promise<SummaryResult & { jobId: string }> {
    const selection = ModelSelector.select({
      role: "llm",
      targetLang: request.targetLang,
      textLength: request.text.length,
    });

    const job = await JobRepository.create({
      kind: "summary",
      status: "running",
      progress: 10,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      inputText: request.text,
      model: selection.modelId,
      modelReason: selection.reason,
    });

    try {
      const summary = await aiEngines.llm.summarize(request.text, {
        style: request.style,
        length: request.length,
        targetLang: request.targetLang,
      });
      await JobRepository.update(job.id, {
        status: "completed",
        progress: 100,
        summary,
        outputText: summary,
      });
      return {
        summary,
        model: selection.modelId,
        wordCount: summary.trim().split(/\s+/).filter(Boolean).length,
        jobId: job.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Summarization failed.";
      await JobRepository.update(job.id, { status: "failed", error: message });
      throw err;
    }
  },
};
