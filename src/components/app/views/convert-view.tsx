"use client";

import { useState } from "react";
import { Repeat2, FileText, FileAudio, Download, Copy, Loader2, Check, Music, X } from "lucide-react";
import { ViewHeader } from "../shared/view-header";
import { UploadDropzone } from "../shared/upload-dropzone";
import { AudioPlayer } from "../shared/audio-player";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatBytes, getCategory } from "@/lib/domain/media-formats";

type SubFormat = "srt" | "vtt" | "txt" | "json";
type AudioFormat = "mp3" | "wav" | "m4a" | "aac" | "flac" | "ogg" | "opus";

interface SubtitleResult { result: string; jobId: string; }
interface AudioResult { jobId: string; outputPath: string; downloadName: string; }

const SAMPLE_SRT =
  "1\n" +
  "00:00:00,500 --> 00:00:03,200\n" +
  "Hello, welcome to the VaakSetu demo.\n\n" +
  "2\n" +
  "00:00:03,400 --> 00:00:06,000\n" +
  "This tool translates Marathi, Hindi, and English.\n\n" +
  "3\n" +
  "00:00:06,200 --> 00:00:09,500\n" +
  "You can convert subtitles between SRT, VTT, TXT, and JSON.\n";

const SUB_FORMATS: { value: SubFormat; label: string }[] = [
  { value: "srt", label: "SRT" },
  { value: "vtt", label: "VTT" },
  { value: "txt", label: "TXT" },
  { value: "json", label: "JSON" },
];

const AUDIO_FORMATS: { value: AudioFormat; label: string }[] = [
  { value: "mp3", label: "MP3" },
  { value: "wav", label: "WAV" },
  { value: "m4a", label: "M4A" },
  { value: "aac", label: "AAC" },
  { value: "flac", label: "FLAC" },
  { value: "ogg", label: "OGG" },
  { value: "opus", label: "Opus" },
];

const BITRATES = ["128k", "192k", "256k", "320k"];
const SAMPLE_RATES = ["22050", "44100", "48000"];
const SUB_MIME: Record<SubFormat, string> = {
  srt: "application/x-subrip",
  vtt: "text/vtt",
  txt: "text/plain",
  json: "application/json",
};

const extOf = (name: string): string => name.split(".").pop()?.toLowerCase() ?? "";

const downloadBlob = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

function SubtitlesTab() {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [to, setTo] = useState<SubFormat>("vtt");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubtitleResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = (evt.target?.result as string) || "";
      setContent(text);
      setResult(null);
      toast.success(`Loaded "${f.name}" (${(f.size / 1024).toFixed(1)} KB)`);
    };
    reader.readAsText(f);
  };

  const convert = async () => {
    if (!content.trim()) {
      toast.error("Upload a subtitle file or paste some subtitle content first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/convert/subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Conversion failed");
      setResult(data as SubtitleResult);
      toast.success(`Converted to ${to.toUpperCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="flex flex-col">
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Input content</Label>
              {fileName && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <FileText className="h-3 w-3" /> {fileName}
                  <button
                    onClick={() => { setFileName(null); setContent(""); }}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span>Upload File</span>
                <input
                  type="file"
                  accept=".srt,.vtt,.txt,.json,.sbv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => { setContent(SAMPLE_SRT); setFileName(null); setResult(null); }}
              >
                Sample SRT
              </Button>
            </div>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"Upload an SRT/VTT/JSON file above or paste:\n1\n00:00:00,000 --> 00:00:02,000\nHello world…"}
            className="min-h-[260px] flex-1 resize-none font-mono text-sm"
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Select value={to} onValueChange={(v) => setTo(v as SubFormat)}>
                <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUB_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={convert} disabled={loading || !content.trim()} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat2 className="h-4 w-4" />}
              Convert
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Output</Label>
            {result && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={copy}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => downloadBlob(`converted.${to}`, result.result, SUB_MIME[to])}
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            )}
          </div>
          {result ? (
            <pre className="scroll-area-thin m-0 min-h-[260px] max-h-96 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed">
              {result.result}
            </pre>
          ) : (
            <div className="flex min-h-[260px] flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
              The converted output will appear here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AudioTab() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<AudioFormat>("mp3");
  const [bitrate, setBitrate] = useState<string>("192k");
  const [sampleRate, setSampleRate] = useState<string>("44100");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AudioResult | null>(null);

  const handleFile = (f: File) => {
    const ext = extOf(f.name);
    if (getCategory(ext) !== "audio") {
      toast.error(`"${ext || "unknown"}" is not an audio file. Drop an MP3, WAV, M4A, FLAC, OGG…`);
      return;
    }
    setFile(f);
    setResult(null);
  };

  const convert = async () => {
    if (!file) {
      toast.error("Select an audio file first.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("format", format);
      form.append("bitrate", bitrate);
      form.append("sampleRate", sampleRate);
      const res = await fetch("/api/convert/audio", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Conversion failed");
      setResult(data as AudioResult);
      toast.success(`Converted to ${format.toUpperCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  if (!file) {
    return <UploadDropzone label="Drop an audio file to convert" onFile={handleFile} />;
  }

  const downloadHref = result ? `/api/download/${result.jobId}/${result.downloadName}` : "";

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Music className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)} · audio · {extOf(file.name).toUpperCase()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => { setFile(null); setResult(null); }}
          >
            <X className="h-3.5 w-3.5" /> Change
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Target format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as AudioFormat)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIO_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Bitrate</Label>
            <Select value={bitrate} onValueChange={setBitrate}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BITRATES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Sample rate</Label>
            <Select value={sampleRate} onValueChange={setSampleRate}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SAMPLE_RATES.map((s) => (
                  <SelectItem key={s} value={s}>{Number(s).toLocaleString()} Hz</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={convert} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat2 className="h-4 w-4" />}
          Convert to {format.toUpperCase()}
        </Button>

        {result && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <FileAudio className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Converted audio</p>
              <Badge variant="secondary" className="ml-auto text-[11px]">{format.toUpperCase()}</Badge>
            </div>
            <AudioPlayer src={downloadHref} label={result.downloadName} />
            <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
              <a href={downloadHref} download={result.downloadName}>
                <Download className="h-4 w-4" /> Download {result.downloadName}
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ConvertView() {
  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Repeat2}
        title="Format Conversion"
        nativeTitle="स्वरूप रूपांतर"
        subtitle="Convert subtitles between SRT, VTT, TXT, JSON — and transcode audio between formats."
      />
      <Tabs defaultValue="subtitles" className="w-full">
        <TabsList>
          <TabsTrigger value="subtitles" className="gap-1.5">
            <FileText className="h-4 w-4" /> Subtitles
          </TabsTrigger>
          <TabsTrigger value="audio" className="gap-1.5">
            <FileAudio className="h-4 w-4" /> Audio
          </TabsTrigger>
        </TabsList>
        <TabsContent value="subtitles" className="mt-4">
          <SubtitlesTab />
        </TabsContent>
        <TabsContent value="audio" className="mt-4">
          <AudioTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
