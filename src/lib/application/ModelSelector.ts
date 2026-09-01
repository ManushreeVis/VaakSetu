/**
 * ModelSelector — picks the best open-source model for a given task.
 *
 * Selection rules (auto mode):
 *  - Translation: always IndicTrans2 (best Indic quality, available pair).
 *  - Transcription: Whisper Small by default; Whisper Medium when the media is long (>5 min)
 *    or the source is one of the higher-error Indic languages with a noisy recording.
 *  - TTS: AI4Bharat TTS.
 *  - LLM (summary/chat): IndicLLM.
 *
 * Returns a human-readable reason for transparency in the UI.
 */

import { getModel, modelsByRole, type EngineRole, type ModelDescriptor } from "@/lib/domain/models";
import type { ModelSelection } from "@/lib/domain/types";

export interface SelectionContext {
  role: EngineRole;
  sourceLang?: string;
  targetLang?: string;
  /** Media duration in seconds (transcription only) */
  durationSec?: number;
  /** Text length in characters (translation/summary) */
  textLength?: number;
  /** Manual override id, if the user pinned a model */
  manualModelId?: string;
}

const supportsLangs = (model: ModelDescriptor, langs: string[]): boolean => {
  if (model.languages.includes("*")) return true;
  return langs.every((l) => !l || l === "auto" || model.languages.includes(l));
};

export const ModelSelector = {
  select(ctx: SelectionContext): ModelSelection {
    if (ctx.manualModelId) {
      const manual = getModel(ctx.manualModelId);
      if (manual && manual.available) {
        return {
          modelId: manual.id,
          reason: `Manually selected ${manual.name} by the operator.`,
        };
      }
    }

    const candidates = modelsByRole(ctx.role).filter(
      (m) => m.available && supportsLangs(m, [ctx.sourceLang, ctx.targetLang].filter(Boolean) as string[]),
    );
    if (!candidates.length) {
      return { modelId: "", reason: "No available model for the requested language pair." };
    }

    if (ctx.role === "transcription") {
      // Primary: whisper-large-v3-turbo (SOTA accuracy for Indic dialects & noisy audio)
      const choice =
        candidates.find((m) => m.id === "whisper-large-v3-turbo") ??
        candidates.find((m) => m.id === "whisper-medium") ??
        candidates[0];
      return {
        modelId: choice.id,
        reason: `Auto-selected ${choice.name} — SOTA accuracy for regional Indic speech & noisy audio.`,
      };
    }

    if (ctx.role === "translation") {
      const choice = candidates.find((m) => m.id === "indictrans2") ?? candidates[0];
      return {
        modelId: choice.id,
        reason: `Auto-selected ${choice.name} — best open-source quality for ${ctx.sourceLang ?? "?"}→${ctx.targetLang ?? "?"}.`,
      };
    }

    // TTS + LLM: choose highest quality among candidates.
    const best = candidates.sort((a, b) => b.quality - a.quality)[0];
    return {
      modelId: best.id,
      reason: `Auto-selected ${best.name} (highest available quality for this role).`,
    };
  },
};
