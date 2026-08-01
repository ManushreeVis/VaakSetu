/** TextTranslator — translates plain text via the TranslationEngine, persisting a history job. */

import { aiEngines } from "@/lib/infrastructure/ai/zai-adapter";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import { ModelSelector } from "./ModelSelector";
import type { TranslationRequest, TranslationResult } from "@/lib/domain/types";

export const TextTranslator = {
  async run(request: TranslationRequest): Promise<TranslationResult & { jobId: string }> {
    const selection = ModelSelector.select({
      role: "translation",
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      textLength: request.text.length,
      manualModelId: request.modelId,
    });

    const job = await JobRepository.create({
      kind: "text",
      status: "running",
      progress: 10,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      inputText: request.text,
      model: selection.modelId,
      modelReason: selection.reason,
    });

    try {
      const result = await aiEngines.translation.translate({
        ...request,
        modelId: selection.modelId,
      });
      await JobRepository.update(job.id, {
        status: "completed",
        progress: 100,
        outputText: result.text,
        model: result.model,
        modelReason: result.modelReason,
      });
      return { ...result, jobId: job.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Translation failed.";
      await JobRepository.update(job.id, { status: "failed", error: message });
      throw err;
    }
  },
};
