/**
 * MediaTranslator — orchestrates the full media translation pipeline:
 *   probe → extract audio → transcribe → translate → build subtitles → synthesize voice.
 *
 * Persists a history Job and all generated artifacts (translated text, TTS audio, SRT, VTT).
 */

import path from "node:path";
import { aiEngines } from "@/lib/infrastructure/ai/zai-adapter";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import { saveOutput } from "@/lib/infrastructure/storage/file-storage";
import { ModelSelector } from "./ModelSelector";
import {
  probeMedia,
  extractAudioForAsr,
} from "@/lib/utils/ffmpeg";
import {
  segmentsToCues,
  toSrt,
  toVtt,
} from "@/lib/utils/subtitles";
import type {
  MediaTranslationRequest,
  MediaTranslationResult,
  TranscriptionSegment,
} from "@/lib/domain/types";

const ensureJobDir = async (jobId: string) => {
  const dir = path.join(process.cwd(), "storage", "workspace", jobId);
  const fs = await import("node:fs/promises");
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

/** Translate each segment, falling back to whole-text translation if per-segment fails. */
const translateSegments = async (
  segments: TranscriptionSegment[],
  sourceLang: string,
  targetLang: string,
  wholeText: string,
): Promise<{ segments: TranscriptionSegment[]; whole: string }> => {
  const translated: TranscriptionSegment[] = [];
  for (const seg of segments) {
    if (!seg.text.trim()) {
      translated.push(seg);
      continue;
    }
    try {
      const r = await aiEngines.translation.translate({
        text: seg.text,
        sourceLang,
        targetLang,
      });
      translated.push({ ...seg, text: r.text });
    } catch {
      translated.push(seg);
    }
  }
  const whole = await aiEngines.translation.translate({
    text: wholeText,
    sourceLang,
    targetLang,
  });
  return { segments: translated, whole: whole.text };
};

export const MediaTranslator = {
  async run(request: MediaTranslationRequest): Promise<MediaTranslationResult & { jobId: string }> {
    const probe = await probeMedia(request.inputPath);
    if (!probe.hasAudio) {
      throw new Error("The uploaded media has no audio track to transcribe.");
    }

    const selection = ModelSelector.select({
      role: "transcription",
      sourceLang: request.sourceLang,
      durationSec: probe.durationSec,
      manualModelId: request.modelId,
    });
    const translationSelection = ModelSelector.select({
      role: "translation",
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
    });

    const job = await JobRepository.create({
      kind: "media",
      status: "running",
      progress: 5,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      inputName: request.inputName,
      inputPath: request.inputPath,
      inputMime: request.inputMime,
      durationSec: probe.durationSec,
      model: `${selection.modelId}+${translationSelection.modelId}`,
      modelReason: `${selection.reason} ${translationSelection.reason}`,
    });

    try {
      const jobDir = await ensureJobDir(job.id);
      const wavPath = path.join(jobDir, "audio.wav");
      await JobRepository.update(job.id, { progress: 15 });
      await extractAudioForAsr(request.inputPath, wavPath);

      await JobRepository.update(job.id, { progress: 35 });
      const transcript = await aiEngines.transcription.transcribe(
        wavPath,
        request.sourceLang === "auto" ? undefined : request.sourceLang,
      );

      await JobRepository.update(job.id, { progress: 55, transcript: transcript.text });
      const { segments: translatedSegs, whole } = await translateSegments(
        transcript.segments,
        request.sourceLang,
        request.targetLang,
        transcript.text,
      );

      await JobRepository.update(job.id, { progress: 75, outputText: whole });

      let outputAudioPath: string | undefined;
      let outputSrt: string | undefined;
      let outputVtt: string | undefined;

      if (request.generateSubtitles) {
        const cues = segmentsToCues(translatedSegs);
        outputSrt = toSrt(cues);
        outputVtt = toVtt(cues);
        await saveOutput(job.id, `${path.parse(request.inputName).name}.${request.targetLang}.srt`, outputSrt);
        await saveOutput(job.id, `${path.parse(request.inputName).name}.${request.targetLang}.vtt`, outputVtt);
      }

      if (request.generateVoice) {
        const audio = await aiEngines.tts.synthesize(whole, request.targetLang);
        const audioName = `${path.parse(request.inputName).name}.${request.targetLang}.wav`;
        outputAudioPath = await saveOutput(job.id, audioName, audio);
      }

      await JobRepository.update(job.id, {
        status: "completed",
        progress: 100,
        transcript: transcript.text,
        outputText: whole,
        outputAudio: outputAudioPath ?? null,
        outputSrt: outputSrt ?? null,
        outputVtt: outputVtt ?? null,
      });

      return {
        transcript: transcript.text,
        translatedText: whole,
        segments: translatedSegs,
        outputAudioPath,
        outputSrt,
        outputVtt,
        model: `${selection.modelId}+${translationSelection.modelId}`,
        modelReason: `${selection.reason} ${translationSelection.reason}`,
        durationSec: probe.durationSec,
        jobId: job.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Media translation failed.";
      await JobRepository.update(job.id, { status: "failed", error: message });
      throw err;
    }
  },
};
