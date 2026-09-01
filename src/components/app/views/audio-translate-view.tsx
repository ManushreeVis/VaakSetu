"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Upload,
  Volume2,
  Download,
  Loader2,
  FileAudio,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  ArrowLeftRight,
  ChevronDown,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AudioPlayer } from "../shared/audio-player";
import { toast } from "sonner";
import { useAppStore } from "../app-store";
import { LANGUAGE_LIST } from "@/lib/domain/languages";
import { cn } from "@/lib/utils";

const QUICK_LANGS = [
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "en", label: "English", native: "English" },
];

interface AudioTranslationResult {
  originalText: string;
  translatedText: string;
  originalAudioUrl: string;
  dubbedAudioUrl: string;
  sourceLang: string;
  targetLang: string;
  durationSec?: number;
}

export function AudioTranslateView() {
  const { defaultSourceLang, defaultTargetLang, setDefaultSourceLang, setDefaultTargetLang } =
    useAppStore();

  const [source, setSource] = useState(defaultSourceLang || "mr");
  const [target, setTarget] = useState(defaultTargetLang || "hi");
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AudioTranslationResult | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    toast.success(`Loaded audio "${f.name}" (${(f.size / (1024 * 1024)).toFixed(2)} MB)`);
  };

  const swapLanguages = () => {
    const prevSrc = source;
    const prevTgt = target;
    setSource(prevTgt);
    setTarget(prevSrc);
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const voiceFile = new File([audioBlob], "recorded_speech.wav", { type: "audio/wav" });
        setFile(voiceFile);
        setResult(null);
        toast.success("Voice recording captured!");
      };

      mediaRecorder.start();
      setRecording(true);
      toast.info("Recording speech… speak clearly");
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const processAudio = async () => {
    if (!file) {
      toast.error("Upload an audio file or record speech first.");
      return;
    }

    setProcessing(true);
    setProgress(15);
    setStep("1. Transcribing speech with Whisper ASR…");

    setDefaultSourceLang(source);
    setDefaultTargetLang(target);

    try {
      // Step 1: Transcribe
      const form = new FormData();
      form.append("file", file);
      form.append("language", source);

      const asrRes = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });

      if (!asrRes.ok) {
        throw new Error("Speech transcription failed");
      }

      const asrData = await asrRes.json();
      const transcribedText = asrData.text || "";

      if (!transcribedText.trim()) {
        throw new Error("No speech detected in the audio file.");
      }

      setProgress(50);
      setStep("2. Translating speech with IndicTrans2…");

      // Step 2: Translate
      const transRes = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcribedText,
          sourceLang: source,
          targetLang: target,
        }),
      });

      if (!transRes.ok) {
        throw new Error("Translation failed");
      }

      const transData = await transRes.json();
      const translatedText = transData.translatedText || transData.text || "";

      setProgress(75);
      setStep("3. Synthesizing neural dubbed speech with Edge-TTS…");

      // Step 3: Synthesize Dubbed Voice
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: translatedText,
          language: target,
        }),
      });

      if (!ttsRes.ok) {
        throw new Error("Voice synthesis failed");
      }

      const ttsData = await ttsRes.json();
      const base = ttsData.path.split("/").pop();
      const jobId = ttsData.path.split("/").slice(-2, -1)[0];
      const dubbedUrl = `/api/download/${jobId}/${base}`;

      const origUrl = URL.createObjectURL(file);

      setProgress(100);
      setResult({
        originalText: transcribedText,
        translatedText,
        originalAudioUrl: origUrl,
        dubbedAudioUrl: dubbedUrl,
        sourceLang: source,
        targetLang: target,
      });

      toast.success("Audio speech translation & dubbing complete!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Audio processing failed");
    } finally {
      setProcessing(false);
      setStep("");
    }
  };

  const downloadDubbedAudio = () => {
    if (!result?.dubbedAudioUrl) return;
    const a = document.createElement("a");
    a.href = result.dubbedAudioUrl;
    a.download = `dubbed_audio_${target}.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadTranscript = () => {
    if (!result?.translatedText) return;
    const content = `ORIGINAL (${source.toUpperCase()}):\n${result.originalText}\n\nTRANSLATED (${target.toUpperCase()}):\n${result.translatedText}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audio_transcript_${target}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Google Translate Surface Card */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-lg shadow-black/5 overflow-hidden">
        {/* Top Attached Language Quick-Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-b bg-muted/20">
          {/* Source Language Bar (Left) */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-1 overflow-x-auto scroll-area-thin">
              {QUICK_LANGS.map((l) => (
                <button
                  key={`src-${l.code}`}
                  onClick={() => setSource(l.code)}
                  className={cn(
                    "rounded-full px-3.5 py-1 text-xs font-medium transition-all duration-150",
                    source === l.code
                      ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {l.label}
                </button>
              ))}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                  {LANGUAGE_LIST.map((l) => (
                    <DropdownMenuItem
                      key={l.code}
                      onClick={() => setSource(l.code)}
                      className={cn("text-xs font-medium", source === l.code && "bg-accent font-semibold")}
                    >
                      <span>{l.name}</span>
                      <span className="ml-2 text-muted-foreground devanagari">{l.nativeName}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={swapLanguages}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Swap languages"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Target Language Bar (Right) */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-1 overflow-x-auto scroll-area-thin">
              {QUICK_LANGS.map((l) => (
                <button
                  key={`tgt-${l.code}`}
                  onClick={() => setTarget(l.code)}
                  className={cn(
                    "rounded-full px-3.5 py-1 text-xs font-medium transition-all duration-150",
                    target === l.code
                      ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {l.label}
                </button>
              ))}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                  {LANGUAGE_LIST.map((l) => (
                    <DropdownMenuItem
                      key={l.code}
                      onClick={() => setTarget(l.code)}
                      className={cn("text-xs font-medium", target === l.code && "bg-accent font-semibold")}
                    >
                      <span>{l.name}</span>
                      <span className="ml-2 text-muted-foreground devanagari">{l.nativeName}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-[10px] text-primary">
              Whisper + IndicTrans2 + TTS
            </Badge>
          </div>
        </div>

        {/* Dual Pane Main Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/60 min-h-[320px]">
          {/* Left Pane: Audio Upload / Record */}
          <div className="flex flex-col justify-between p-6 bg-background">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Input Audio / Speech
                </span>
                {file && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <FileAudio className="h-3.5 w-3.5" /> {file.name}
                  </Badge>
                )}
              </div>

              {/* Upload Drop Area */}
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-muted/10 p-8 text-center cursor-pointer transition-colors hover:bg-muted/20 hover:border-primary/50">
                <FileAudio className="h-10 w-10 text-primary/70 mb-2" />
                <p className="text-sm font-medium text-foreground">
                  {file ? file.name : "Drop your audio file here or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports MP3, WAV, M4A, AAC, FLAC, OGG (up to 50 MB)
                </p>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>

              {/* Or Record Speech */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant={recording ? "destructive" : "outline"}
                  onClick={toggleRecording}
                  className={cn("gap-2 rounded-full", recording && "animate-pulse")}
                >
                  {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  <span>{recording ? "Stop Recording" : "Record with Microphone"}</span>
                </Button>
              </div>
            </div>

            {/* Left Bottom Action */}
            <div className="pt-4 border-t border-border/40 mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "No audio loaded"}
              </span>
              <Button
                onClick={processAudio}
                disabled={processing || !file}
                className="gap-2 shadow-sm"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{processing ? "Dubbing Audio…" : "Translate & Dub Audio"}</span>
              </Button>
            </div>
          </div>

          {/* Right Pane: Dubbed Output & Transcript */}
          <div className="flex flex-col justify-between p-6 bg-muted/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Dubbed Audio & Transcript ({target.toUpperCase()})
                </span>
                {result && (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs">
                    ✓ Complete
                  </Badge>
                )}
              </div>

              {processing ? (
                <div className="flex flex-col items-center justify-center min-h-[200px] text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">{step}</p>
                  <Progress value={progress} className="w-3/4 h-2" />
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {/* Dubbed Audio Player */}
                  <div className="rounded-xl border bg-background/80 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Dubbed Audio ({target.toUpperCase()})
                    </p>
                    <AudioPlayer src={result.dubbedAudioUrl} label={`Dubbed Speech (${target.toUpperCase()})`} />
                  </div>

                  {/* Synchronized Translated Transcript */}
                  <div className="rounded-xl border bg-background/60 p-4 max-h-44 overflow-y-auto scroll-area-thin">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Translated Transcript
                    </p>
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {result.translatedText}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[200px] rounded-xl border border-dashed bg-muted/20 text-center p-6 text-xs text-muted-foreground">
                  <Volume2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p>Upload or record audio on the left and click &apos;Translate &amp; Dub Audio&apos;.</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    The translated speech will be synthesized and available to play &amp; download here.
                  </p>
                </div>
              )}
            </div>

            {/* Right Bottom Toolbar */}
            {result && (
              <div className="pt-4 border-t border-border/40 mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={downloadDubbedAudio} className="gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" /> Dubbed Audio (WAV)
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadTranscript} className="gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" /> Transcript (TXT)
                  </Button>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Edge Neural TTS
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
