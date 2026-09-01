/** Core domain types shared across application + infrastructure layers. */

export type JobKind = "text" | "media" | "summary" | "convert";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "canceled";

export interface TranslationRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  /** Override auto-selection; when undefined the ModelSelector decides. */
  modelId?: string;
}

export interface GlossaryMatch {
  source: string;
  expected: string;
  applied: boolean;
}

export interface GlossaryApplied {
  matched: GlossaryMatch[];
  changed: boolean;
}

export interface TranslationResult {
  text: string;
  model: string;
  modelReason: string;
  detectedSourceLang?: string;
  /** Glossary terms that were matched/applied during post-processing. */
  glossary?: GlossaryApplied;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  detectedLanguage?: string;
  model: string;
}

export interface MediaTranslationRequest {
  inputPath: string;
  inputName: string;
  inputMime?: string;
  sourceLang: string;
  targetLang: string;
  modelId?: string;
  /** Whether to also generate translated voice (TTS) */
  generateVoice: boolean;
  /** Whether to also generate subtitles (SRT+VTT) */
  generateSubtitles: boolean;
}

export interface MediaTranslationResult {
  transcript: string;
  translatedText: string;
  segments: TranscriptionSegment[];
  sourceSegments?: TranscriptionSegment[];
  outputAudioPath?: string;
  outputSrt?: string;
  outputVtt?: string;
  sourceSrt?: string;
  sourceVtt?: string;
  inputVideoPath?: string;
  inputVideoName?: string;
  dubbedVideoPath?: string;
  dubbedVideoName?: string;
  hasVideo?: boolean;
  model: string;
  modelReason: string;
  durationSec?: number;
}


export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  audioPath?: string;
  replyAudio?: string;
}

export interface SummaryRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  /** "bullets" | "paragraph" */
  style: "bullets" | "paragraph";
  /** "short" | "medium" | "detailed" */
  length: "short" | "medium" | "detailed";
}

export interface SummaryResult {
  summary: string;
  model: string;
  wordCount: number;
}

export interface ModelSelection {
  modelId: string;
  reason: string;
}

export interface ApiError {
  error: string;
  detail?: string;
}
