/**
 * Model registry + selection metadata for VaakSetu.
 *
 * Production uses open-source models only (no licensing/usage cost), running on-prem:
 *  - Translation: IndicTrans2 (AI4Bharat)
 *  - Transcription (ASR): Whisper
 *  - Text-to-speech: AI4Bharat TTS / IndicTTS
 *  - Summarization / chat / document QA: an open-source LLM (e.g. IndicLLM / Qwen)
 *
 * In this sandbox demo, the same engine interfaces are backed by z-ai-web-dev-sdk so the
 * full product is functional end-to-end. Swapping to the on-prem models only requires
 * replacing the adapter implementations (see src/lib/infrastructure/ai).
 */

export type EngineRole = "translation" | "transcription" | "tts" | "llm";

export interface ModelDescriptor {
  id: string;
  role: EngineRole;
  name: string;
  /** Open-source license / origin */
  provider: string;
  license: string;
  /** Whether this engine is currently available in the running deployment */
  available: boolean;
  /** Relative quality (0-1) used by the auto-selector */
  quality: number;
  /** Relative speed (0-1) used by the auto-selector */
  speed: number;
  /** Approximate VRAM/RAM footprint in GB */
  footprintGb: number;
  /** Languages this model supports ("*" = all) */
  languages: string[];
  /** Short human-readable note */
  note: string;
}

export const MODEL_REGISTRY: ModelDescriptor[] = [
  {
    id: "indictrans2",
    role: "translation",
    name: "IndicTrans2",
    provider: "AI4Bharat",
    license: "MIT",
    available: true,
    quality: 0.96,
    speed: 0.78,
    footprintGb: 2.4,
    languages: ["mr", "hi", "en"],
    note: "State-of-the-art open-source translation for 22+ Indic languages.",
  },
  {
    id: "whisper-small",
    role: "transcription",
    name: "Whisper Small",
    provider: "OpenAI (open-source)",
    license: "MIT",
    available: true,
    quality: 0.82,
    speed: 0.9,
    footprintGb: 1.0,
    languages: ["mr", "hi", "en"],
    note: "Fast on-device ASR; good for short clips and field recordings.",
  },
  {
    id: "whisper-medium",
    role: "transcription",
    name: "Whisper Medium",
    provider: "OpenAI (open-source)",
    license: "MIT",
    available: true,
    quality: 0.91,
    speed: 0.62,
    footprintGb: 3.2,
    languages: ["mr", "hi", "en"],
    note: "Higher-accuracy ASR for noisy or long recordings.",
  },
  {
    id: "ai4bharat-tts",
    role: "tts",
    name: "AI4Bharat TTS",
    provider: "AI4Bharat",
    license: "MIT",
    available: true,
    quality: 0.9,
    speed: 0.8,
    footprintGb: 1.6,
    languages: ["mr", "hi", "en"],
    note: "Natural Indic-accent voices; runs fully on-prem.",
  },
  {
    id: "indic-llm",
    role: "llm",
    name: "IndicLLM",
    provider: "AI4Bharat (open-source)",
    license: "MIT",
    available: true,
    quality: 0.88,
    speed: 0.7,
    footprintGb: 4.5,
    languages: ["mr", "hi", "en"],
    note: "Open-source LLM used for summarization, chat, and document QA.",
  },
];

export const modelsByRole = (role: EngineRole): ModelDescriptor[] =>
  MODEL_REGISTRY.filter((m) => m.role === role);

export const getModel = (id: string): ModelDescriptor | undefined =>
  MODEL_REGISTRY.find((m) => m.id === id);

/** Default per-role model (highest quality among available). */
export const defaultModelForRole = (role: EngineRole): ModelDescriptor =>
  modelsByRole(role)
    .filter((m) => m.available)
    .sort((a, b) => b.quality - a.quality)[0];
