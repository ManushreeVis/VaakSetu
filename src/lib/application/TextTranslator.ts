/** TextTranslator — translates plain text via the TranslationEngine, persisting a history job. */

import { aiEngines } from "@/lib/infrastructure/ai/zai-adapter";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import { ModelSelector } from "./ModelSelector";
import { GlossaryService, type AppliedGlossary } from "./GlossaryService";
import type { TranslationRequest, TranslationResult } from "@/lib/domain/types";

export interface BatchTranslationItem {
  source: string;
  target: string;
  ok: boolean;
  error?: string;
}

export interface BatchTranslationResult {
  items: BatchTranslationItem[];
  model: string;
  modelReason: string;
  jobId: string;
  succeeded: number;
  failed: number;
}

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
      // Apply glossary: enforce approved domain terminology.
      const glossaryApplied = await GlossaryService.applyToTranslation({
        text: result.text,
        sourceText: request.text,
        sourceLang: request.sourceLang,
        targetLang: request.targetLang,
      });
      const finalText = glossaryApplied.text;
      const modelReason = glossaryApplied.glossary.changed
        ? `${result.modelReason} · glossary applied (${glossaryApplied.glossary.matched.filter((m) => m.applied).length} term${glossaryApplied.glossary.matched.filter((m) => m.applied).length === 1 ? "" : "s"})`
        : result.modelReason;
      await JobRepository.update(job.id, {
        status: "completed",
        progress: 100,
        outputText: finalText,
        model: result.model,
        modelReason,
      });
      return {
        ...result,
        text: finalText,
        modelReason,
        jobId: job.id,
        glossary: glossaryApplied.glossary,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Translation failed.";
      await JobRepository.update(job.id, { status: "failed", error: message });
      throw err;
    }
  },

  /** Translate many source lines in one batch, preserving line order. */
  async runBatch(opts: {
    sources: string[];
    sourceLang: string;
    targetLang: string;
  }): Promise<BatchTranslationResult> {
    const { sources, sourceLang, targetLang } = opts;
    const lines = sources.map((s) => s.trim()).filter((s) => s.length > 0);

    const selection = ModelSelector.select({
      role: "translation",
      sourceLang,
      targetLang,
      textLength: lines.reduce((a, l) => a + l.length, 0),
    });

    const job = await JobRepository.create({
      kind: "text",
      status: "running",
      progress: 5,
      sourceLang,
      targetLang,
      inputText: lines.join("\n"),
      model: selection.modelId,
      modelReason: `${selection.reason} (batch · ${lines.length} lines)`,
    });

    try {
      const items: BatchTranslationItem[] = [];
      // Translate sequentially to keep adapter load reasonable and preserve order.
      // (Production IndicTrans2 supports true batching; this loop mirrors that
      // behaviour one line at a time for the demo adapter.)
      for (let i = 0; i < lines.length; i++) {
        try {
          const r = await aiEngines.translation.translate({
            text: lines[i],
            sourceLang,
            targetLang,
            modelId: selection.modelId,
          });
          items.push({ source: lines[i], target: r.text, ok: true });
        } catch (e) {
          items.push({
            source: lines[i],
            target: "",
            ok: false,
            error: e instanceof Error ? e.message : "failed",
          });
        }
        await JobRepository.update(job.id, {
          progress: Math.round(5 + (i + 1) / lines.length * 90),
        });
      }

      const succeeded = items.filter((i) => i.ok).length;
      const failed = items.length - succeeded;

      await JobRepository.update(job.id, {
        status: failed === items.length ? "failed" : "completed",
        progress: 100,
        outputText: items.map((i) => i.target).join("\n"),
        model: selection.modelId,
        modelReason: `${selection.reason} (batch · ${succeeded}/${items.length} ok)`,
        error: failed > 0 ? `${failed} line(s) failed to translate.` : null,
      });

      return {
        items,
        model: selection.modelId,
        modelReason: selection.reason,
        jobId: job.id,
        succeeded,
        failed,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Batch translation failed.";
      await JobRepository.update(job.id, { status: "failed", error: message });
      throw err;
    }
  },
};
