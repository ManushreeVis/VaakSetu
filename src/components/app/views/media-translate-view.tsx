"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clapperboard,
  FileVideo,
  FileAudio,
  Loader2,
  Download,
  Languages,
  Volume2,
  Captions,
  X,
  RotateCcw,
  Clock,
  FileText,
  ListTree,
  AlertCircle,
  ArrowRight,
  Film,
  Check,
} from "lucide-react";
import { ViewHeader } from "../shared/view-header";
import { LanguageSelect } from "../shared/language-select";
import { UploadDropzone } from "../shared/upload-dropzone";
import { ModelBadge } from "../shared/model-badge";
import { AudioPlayer } from "../shared/audio-player";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useAppStore } from "../app-store";
import { formatBytes, getFormatByExt, getCategory } from "@/lib/domain/media-formats";
import { languageLabel, languageNative } from "@/lib/domain/languages";

interface MediaSegment {
  start: number;
  end: number;
  text: string;
}

interface MediaResult {
  transcript: string;
  translatedText: string;
  segments: MediaSegment[];
  outputAudioPath?: string;
  outputSrt?: string;
  outputVtt?: string;
  model: string;
  modelReason: string;
  durationSec?: number;
  jobId: string;
}

const STATUS_MESSAGES = [
  "Extracting audio…",
  "Transcribing speech…",
  "Translating to target language…",
  "Generating translated voice…",
  "Building subtitles…",
  "Finalizing outputs…",
];

const getExt = (name: string): string => name.split(".").pop() ?? "";

const formatDuration = (sec?: number): string | null => {
  if (!sec || !isFinite(sec)) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatTimestamp = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const downloadBlob = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const downloadUrl = (url: string, filename: string) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const basename = (p: string): string => p.split(/[\\/]/).pop() ?? p;

/** Selected file summary card. */
const FileChip = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const ext = getExt(file.name);
  const cat = getCategory(ext);
  const Icon = cat === "video" ? FileVideo : FileAudio;
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatBytes(file.size)}</span>
            <Separator orientation="vertical" className="h-3" />
            <Badge variant="secondary" className="text-[10px] uppercase">
              {cat ?? "file"}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove file">
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

/** Output options card. */
const OptionsCard = ({
  voice, setVoice,
  subtitles, setSubtitles,
  autoModel, setAutoModel,
}: {
  voice: boolean;
  setVoice: (v: boolean) => void;
  subtitles: boolean;
  setSubtitles: (v: boolean) => void;
  autoModel: boolean;
  setAutoModel: (v: boolean) => void;
}) => (
  <Card>
    <CardContent className="space-y-4 p-4">
      <p className="text-sm font-medium">Output options</p>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-sm">Translated voice (TTS)</Label>
          <p className="text-xs text-muted-foreground">Synthesize spoken audio in the target language.</p>
        </div>
        <Switch checked={voice} onCheckedChange={setVoice} aria-label="Generate translated voice" />
      </div>
      <Separator />
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-sm">Subtitles (SRT + VTT)</Label>
          <p className="text-xs text-muted-foreground">Generate timed subtitle files for video.</p>
        </div>
        <Switch checked={subtitles} onCheckedChange={setSubtitles} aria-label="Generate subtitles" />
      </div>
      <Separator />
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-sm">Auto-select model</Label>
          <p className="text-xs text-muted-foreground">Let the engine choose the best model.</p>
        </div>
        <Switch checked={autoModel} onCheckedChange={setAutoModel} aria-label="Auto select model" />
      </div>
    </CardContent>
  </Card>
);

/** Indeterminate-style progress with rotating status message. */
const ProgressBlock = ({ message, tick }: { message: string; tick: number }) => {
  const value = ((tick % 9) + 1) * 10; // 10 → 90, then wrap
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{message}</p>
            <p className="text-xs text-muted-foreground">Processing usually takes 15–60 seconds.</p>
          </div>
        </div>
        <Progress value={value} className="h-2" />
      </CardContent>
    </Card>
  );
};

/** Burn the SRT subtitles into the source video (hardcoded captions) and download. */
const BurnCaptionsButton = ({ jobId, target }: { jobId: string; target: string }) => {
  const [burning, setBurning] = useState(false);
  const [done, setDone] = useState(false);

  const burn = async () => {
    setBurning(true);
    try {
      const res = await fetch(`/api/media/${jobId}/burn`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to burn captions.");
      // Trigger download of the burned video.
      downloadUrl(`/api/download/${jobId}/${data.downloadName}`, data.downloadName);
      setDone(true);
      toast.success(`Burned captions into video (${data.downloadName}).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to burn captions.");
    } finally {
      setBurning(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="default"
      className="gap-1.5"
      onClick={burn}
      disabled={burning}
    >
      {burning ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Burning captions…</>
      ) : done ? (
        <><Check className="h-4 w-4" /> Burned — download again</>
      ) : (
        <><Film className="h-4 w-4" /> Burn into video</>
      )}
    </Button>
  );
};

const ResultsTabs = ({ result, target }: { result: MediaResult; target: string }) => {
  const audioName = result.outputAudioPath ? basename(result.outputAudioPath) : null;
  const audioUrl = audioName ? `/api/download/${result.jobId}/${audioName}` : null;
  const baseName = result.jobId;
  const duration = formatDuration(result.durationSec);
  const hasSubs = Boolean(result.outputSrt || result.outputVtt);
  const hasVoice = Boolean(audioUrl);

  const downloadAll = async () => {
    if (result.outputSrt) {
      downloadBlob(result.outputSrt, `${baseName}.srt`, "application/x-subrip");
      await new Promise((r) => setTimeout(r, 400));
    }
    if (result.outputVtt) {
      downloadBlob(result.outputVtt, `${baseName}.vtt`, "text/vtt");
      await new Promise((r) => setTimeout(r, 400));
    }
    if (audioUrl && audioName) downloadUrl(audioUrl, audioName);
    toast.success("Downloaded all available artifacts.");
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <Tabs defaultValue="translation">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="w-fit">
              <TabsTrigger value="translation" className="gap-1.5">
                <Languages className="h-4 w-4" /> Translation
              </TabsTrigger>
              <TabsTrigger value="subtitles" className="gap-1.5" disabled={!hasSubs}>
                <Captions className="h-4 w-4" /> Subtitles
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-1.5" disabled={!hasVoice}>
                <Volume2 className="h-4 w-4" /> Voice
              </TabsTrigger>
              <TabsTrigger value="segments" className="gap-1.5">
                <ListTree className="h-4 w-4" /> Segments
              </TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadAll}>
              <Download className="h-4 w-4" /> Download all
            </Button>
          </div>

          <TabsContent value="translation" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ModelBadge modelId={result.model} />
              {duration && (
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <Clock className="h-3 w-3" /> {duration}
                </Badge>
              )}
              <Badge variant="outline" className="text-[11px]">→ {languageLabel(target)}</Badge>
            </div>
            <div className="rounded-lg border bg-primary/5 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Translated text
              </p>
              <p className="whitespace-pre-wrap text-base leading-relaxed" lang={target}>
                {result.translatedText || "—"}
              </p>
            </div>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <FileText className="h-4 w-4" /> Show original transcript
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {result.transcript || "—"}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
            {result.modelReason && (
              <p className="text-[11px] italic text-muted-foreground">{result.modelReason}</p>
            )}
          </TabsContent>

          <TabsContent value="subtitles" className="mt-4 space-y-3">
            {hasSubs ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {result.outputSrt && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => downloadBlob(result.outputSrt!, `${baseName}.srt`, "application/x-subrip")}
                    >
                      <Download className="h-4 w-4" /> Download SRT
                    </Button>
                  )}
                  {result.outputVtt && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => downloadBlob(result.outputVtt!, `${baseName}.vtt`, "text/vtt")}
                    >
                      <Download className="h-4 w-4" /> Download VTT
                    </Button>
                  )}
                  <BurnCaptionsButton jobId={result.jobId} target={target} />
                </div>
                <ScrollArea className="h-96 rounded-lg border">
                  <pre className="bg-muted/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {result.outputSrt ?? result.outputVtt ?? "No subtitles generated."}
                  </pre>
                </ScrollArea>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No subtitles were generated for this run.
              </p>
            )}
          </TabsContent>

          <TabsContent value="voice" className="mt-4 space-y-3">
            {audioUrl && audioName ? (
              <div className="space-y-3">
                <AudioPlayer src={audioUrl} label={`Translated voice · ${languageNative(target)}`} />
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={audioUrl} download={audioName}>
                    <Download className="h-4 w-4" /> Download audio
                  </a>
                </Button>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No voice was generated for this run.
              </p>
            )}
          </TabsContent>

          <TabsContent value="segments" className="mt-4">
            {result.segments?.length ? (
              <ScrollArea className="h-96 rounded-lg border">
                <ol className="divide-y">
                  {result.segments.map((seg, i) => (
                    <li key={i} className="flex gap-3 p-3">
                      <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                        {formatTimestamp(seg.start)} → {formatTimestamp(seg.end)}
                      </Badge>
                      <span className="text-sm">{seg.text}</span>
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No segment data available.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export function MediaTranslateView() {
  const {
    defaultSourceLang,
    defaultTargetLang,
    setDefaultSourceLang,
    setDefaultTargetLang,
    autoModel,
    setAutoModel,
  } = useAppStore();
  const [source, setSource] = useState(defaultSourceLang);
  const [target, setTarget] = useState(defaultTargetLang);
  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState(true);
  const [subtitles, setSubtitles] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MediaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);
  const [tick, setTick] = useState(0);

  // Rotating status messages + progress tick while loading.
  useEffect(() => {
    if (!loading) return;
    const msgTimer = setInterval(() => {
      setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 3500);
    const tickTimer = setInterval(() => setTick((t) => t + 1), 700);
    return () => {
      clearInterval(msgTimer);
      clearInterval(tickTimer);
    };
  }, [loading]);

  const onFile = useCallback((incoming: File) => {
    const ext = getExt(incoming.name);
    if (!getFormatByExt(ext)) {
      toast.error(`Unsupported file format ".${ext}".`);
      return;
    }
    setResult(null);
    setError(null);
    setFile(incoming);
  }, []);

  const runTranslate = async () => {
    if (!file) {
      toast.error("Please upload a media file first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setStatusIdx(0);
    setTick(0);
    setDefaultSourceLang(source);
    setDefaultTargetLang(target);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("sourceLang", source);
      fd.append("targetLang", target);
      fd.append("voice", String(voice));
      fd.append("subtitles", String(subtitles));
      const res = await fetch("/api/media", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Media translation failed.");
      setResult(data as MediaResult);
      toast.success("Translation complete.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Media translation failed.");
      toast.error("Translation failed.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Clapperboard}
        title="Audio & Video Translation"
        nativeTitle="ध्वनी व व्हिडिओ भाषांतर"
        subtitle="Transcribe speech, translate, and generate voice + subtitles from any media file."
      />

      {/* Language selector row */}
      <Card>
        <CardContent className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs text-muted-foreground">From</Label>
            <LanguageSelect
              variant="source"
              value={source}
              onChange={setSource}
              className="w-full"
              id="media-source-lang"
            />
          </div>
          <div className="flex items-end justify-center pb-2">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs text-muted-foreground">To</Label>
            <LanguageSelect
              variant="target"
              value={target}
              onChange={setTarget}
              className="w-full"
              id="media-target-lang"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Upload + options column */}
        <div className="space-y-4">
          {file ? (
            <FileChip file={file} onRemove={() => setFile(null)} />
          ) : (
            <UploadDropzone onFile={onFile} disabled={loading} />
          )}
          <OptionsCard
            voice={voice}
            setVoice={setVoice}
            subtitles={subtitles}
            setSubtitles={setSubtitles}
            autoModel={autoModel}
            setAutoModel={setAutoModel}
          />
        </div>

        {/* Action card */}
        <Card>
          <CardContent className="flex h-full flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Pipeline</p>
              <Badge variant="outline" className="text-[11px]">
                {languageLabel(source)} → {languageLabel(target)}
              </Badge>
            </div>
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <Clapperboard className="h-3.5 w-3.5 text-primary" />
                ASR → Translate → TTS + Subtitles
              </p>
              <p className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                First-time processing may take up to a minute.
              </p>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button onClick={runTranslate} disabled={loading || !file} className="gap-1.5">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Languages className="h-4 w-4" />
                )}
                Translate media
              </Button>
              {(file || result) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={reset}
                  disabled={loading}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {loading && <ProgressBlock message={STATUS_MESSAGES[statusIdx]} tick={tick} />}

      {error && !loading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Translation failed</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{error}</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={runTranslate}>
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {result && !loading && <ResultsTabs result={result} target={target} />}
    </div>
  );
}
