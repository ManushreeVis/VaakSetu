"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessagesSquare,
  Mic,
  MicOff,
  Send,
  Plus,
  Trash2,
  FileText,
  Volume2,
  Loader2,
  ChevronDown,
  ArrowLeft,
  Upload,
  MessageCircle,
  BookOpen,
  Download,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader } from "../shared/view-header";
import { LanguageSelect } from "../shared/language-select";
import { AudioPlayer } from "../shared/audio-player";
import { EmptyState } from "../shared/empty-state";
import { useAppStore } from "../app-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { languageLabel, languageNative } from "@/lib/domain/languages";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface SessionSummary {
  id: string;
  title: string;
  sourceLang: string;
  targetLang: string;
  documentName: string | null;
  updatedAt: string;
  _count: { messages: number };
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioPath: string | null;
  replyAudio: string | null;
  createdAt: string;
}

interface ChatSessionDetail extends SessionSummary {
  documentText: string | null;
  messages: ChatMessage[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const assetUrl = (sessionId: string, audioPath: string) => {
  const base = audioPath.split(/[\\/]/).pop() ?? audioPath;
  return `/api/download/${sessionId}/${base}`;
};

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};

/* ------------------------------------------------------------------ */
/* New-session form                                                    */
/* ------------------------------------------------------------------ */

interface NewSessionFormProps {
  onCreated: (id: string) => void;
  titleRef?: React.RefObject<HTMLInputElement | null>;
}

const NewSessionForm = ({ onCreated, titleRef }: NewSessionFormProps) => {
  const { defaultSourceLang, defaultTargetLang, setDefaultSourceLang, setDefaultTargetLang } =
    useAppStore();
  const [title, setTitle] = useState("");
  const [sourceLang, setSourceLang] = useState(defaultSourceLang);
  const [targetLang, setTargetLang] = useState(defaultTargetLang);
  const [documentText, setDocumentText] = useState("");
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Persist language defaults for the rest of the app.
  useEffect(() => {
    setDefaultSourceLang(sourceLang);
  }, [sourceLang, setDefaultSourceLang]);
  useEffect(() => {
    setDefaultTargetLang(targetLang);
  }, [targetLang, setDefaultTargetLang]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10_000_000) {
      toast.error("Document too large", { description: "Keep files under 10 MB." });
      return;
    }
    try {
      const text = await file.text();
      setDocumentText(text);
      setDocumentName(file.name);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success(`Loaded "${file.name}"`);
    } catch {
      toast.error("Could not read file");
    }
  };

  const start = async () => {
    if (!documentText.trim()) {
      toast.error("Add some document text first");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "New document chat",
          sourceLang,
          targetLang,
          documentText,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const { id } = (await res.json()) as { id: string };
      toast.success("Session created");
      setTitle("");
      setDocumentText("");
      setDocumentName(null);
      onCreated(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4 text-primary" /> New chat
        </CardTitle>
        <CardDescription className="text-xs">
          Paste a document or upload a .txt file, then start asking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="dc-title" className="text-xs">Title</Label>
          <Input
            id="dc-title"
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. BAIF annual report"
            className="h-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Document language</Label>
            <LanguageSelect value={sourceLang} onChange={setSourceLang} variant="source" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reply language</Label>
            <LanguageSelect value={targetLang} onChange={setTargetLang} variant="target" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="dc-doc" className="text-xs">Document text</Label>
            <Label
              htmlFor="dc-file"
              className="flex cursor-pointer items-center gap-1 text-xs text-primary hover:underline"
            >
              <Upload className="h-3 w-3" /> Upload Document
            </Label>
            <Input
              id="dc-file"
              type="file"
              accept=".txt,.md,.json,.pdf,.docx"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>
          <Textarea
            id="dc-doc"
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
            placeholder="Paste the document content here…"
            className="min-h-[120px] resize-y scroll-area-thin text-sm"
          />
          {documentName && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" /> {documentName}
            </p>
          )}
        </div>
        <Button onClick={start} disabled={creating} className="w-full gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessagesSquare className="h-4 w-4" />}
          {creating ? "Starting…" : "Start chat"}
        </Button>
      </CardContent>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* Session list item                                                   */
/* ------------------------------------------------------------------ */

const SessionListItem = ({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: SessionSummary;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(e) => e.key === "Enter" && onSelect()}
    className={cn(
      "group flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors",
      active ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/60",
    )}
  >
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{session.title}</p>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
        {session.documentName && (
          <span className="flex items-center gap-0.5 truncate">
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate">{session.documentName}</span>
          </span>
        )}
        <span className="shrink-0">{session._count.messages} msg</span>
        <span className="shrink-0">· {timeAgo(session.updatedAt)}</span>
      </div>
    </div>
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          aria-label="Delete session"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
          <AlertDialogDescription>
            “{session.title}” and all its messages will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);

/* ------------------------------------------------------------------ */
/* Message bubble                                                      */
/* ------------------------------------------------------------------ */

const MessageBubble = ({ message, sessionId }: { message: ChatMessage; sessionId: string }) => {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] space-y-2", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
            isUser
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-card border",
          )}
        >
          {message.content}
          {isUser && message.audioPath && (
            <Badge
              variant="secondary"
              className="ml-2 gap-1 bg-primary-foreground/15 text-primary-foreground"
            >
              <Mic className="h-3 w-3" /> voice
            </Badge>
          )}
        </div>
        {!isUser && message.replyAudio && (
          <AudioPlayer
            src={assetUrl(sessionId, message.replyAudio)}
            label="Spoken reply"
            className="rounded-2xl rounded-bl-sm"
          />
        )}
        <p className="px-1 text-[10px] text-muted-foreground">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
};

const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border bg-card px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  </div>
);

const RecordingIndicator = () => (
  <div className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
    </span>
    Recording… tap mic to stop
  </div>
);

/* ------------------------------------------------------------------ */
/* Input bar                                                           */
/* ------------------------------------------------------------------ */

interface InputBarProps {
  disabled: boolean;
  recording: boolean;
  sending: boolean;
  speakReply: boolean;
  onSpeakChange: (v: boolean) => void;
  onSendText: (text: string) => void;
  onToggleRecord: () => void;
  onVoiceFile: (file: File) => void;
}

const InputBar = ({
  disabled,
  recording,
  sending,
  speakReply,
  onSpeakChange,
  onSendText,
  onToggleRecord,
  onVoiceFile,
}: InputBarProps) => {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled || recording) return;
    onSendText(t);
    setText("");
  };

  return (
    <div className="space-y-2 rounded-xl border bg-card p-3 shadow-sm">
      {recording && <RecordingIndicator />}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={recording ? "Listening…" : "Ask about your document…  (Enter to send · Shift+Enter for newline)"}
        disabled={disabled}
        className="min-h-[44px] max-h-40 resize-none scroll-area-thin text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant={recording ? "destructive" : "outline"}
          className="h-9 w-9"
          onClick={onToggleRecord}
          disabled={disabled}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          aria-label="Upload voice file"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onVoiceFile(f);
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-2 px-1">
          <Switch checked={speakReply} onCheckedChange={onSpeakChange} id="speak-reply" />
          <Label htmlFor="speak-reply" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Volume2 className="h-3.5 w-3.5" /> Speak reply
          </Label>
        </div>
        <Button
          onClick={submit}
          disabled={disabled || recording || sending || !text.trim()}
          className="ml-auto gap-2"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Handbook / Multipage Document Translator Component                */
/* ------------------------------------------------------------------ */

interface HandbookTranslatorProps {
  onSendToChat: (docText: string, title: string) => void;
}

const HandbookTranslator = ({ onSendToChat }: HandbookTranslatorProps) => {
  const [fileName, setFileName] = useState<string>("");
  const [docText, setDocText] = useState<string>("");
  const [sourceLang, setSourceLang] = useState<string>("en");
  const [targetLang, setTargetLang] = useState<string>("mr");
  const [translating, setTranslating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [translatedText, setTranslatedText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setTranslatedText("");
    try {
      const text = await f.text();
      setDocText(text);
      toast.success(`Loaded "${f.name}" (${(f.size / 1024).toFixed(1)} KB)`);
    } catch {
      toast.error("Could not read file");
    }
  };

  const translateHandbook = async () => {
    if (!docText.trim()) {
      toast.error("Upload a handbook document or paste content first.");
      return;
    }
    setTranslating(true);
    setProgress(10);
    setTranslatedText("");

    try {
      // Split into paragraphs for parallel chunked translation
      const paragraphs = docText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

      if (paragraphs.length === 0) {
        throw new Error("Document is empty.");
      }

      const translatedParagraphs: string[] = [];
      const CHUNK_SIZE = 4;
      const totalChunks = Math.ceil(paragraphs.length / CHUNK_SIZE);

      for (let c = 0; c < paragraphs.length; c += CHUNK_SIZE) {
        const chunk = paragraphs.slice(c, c + CHUNK_SIZE);
        const chunkPromises = chunk.map(async (para) => {
          try {
            const res = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: para,
                sourceLang,
                targetLang,
              }),
            });
            if (!res.ok) throw new Error("Translation error");
            const data = await res.json();
            return data.translatedText || para;
          } catch {
            return para;
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        translatedParagraphs.push(...chunkResults);

        const currentChunkIdx = Math.floor(c / CHUNK_SIZE) + 1;
        setProgress(Math.min(95, Math.round((currentChunkIdx / totalChunks) * 100)));
      }

      const fullResult = translatedParagraphs.join("\n\n");
      setTranslatedText(fullResult);
      setProgress(100);
      toast.success("Handbook translation complete!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setTranslating(false);
    }
  };

  const downloadTranslated = () => {
    if (!translatedText) return;
    const blob = new Blob([translatedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = fileName ? fileName.replace(/\.[^.]+$/, "") : "handbook";
    a.href = url;
    a.download = `${baseName}_${targetLang}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!translatedText) return;
    await navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      {/* Configuration Header Card */}
      <Card className="border-primary/30 bg-primary/[0.02]">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-semibold text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Multi-Page Handbook & Document Translator
              </p>
              <p className="text-xs text-muted-foreground">
                Upload English, Hindi, or Marathi training handbooks, manuals, or multi-page documents to translate all sections with IndicTrans2.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Handbook (.txt, .md, .pdf)</span>
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.docx,.json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              {fileName && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <FileText className="h-3.5 w-3.5" /> {fileName}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Handbook Original Language</Label>
              <LanguageSelect value={sourceLang} onChange={setSourceLang} variant="source" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Translate Into</Label>
              <LanguageSelect value={targetLang} onChange={setTargetLang} variant="target" />
            </div>
            <div className="flex items-end">
              <Button
                onClick={translateHandbook}
                disabled={translating || !docText.trim()}
                className="w-full gap-2 shadow-sm"
              >
                {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {translating ? `Translating (${progress}%)…` : "Translate Entire Handbook"}
              </Button>
            </div>
          </div>

          {translating && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Parallel chunking & translating with IndicTrans2…</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Side-by-Side Dual Pane Viewer */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left Pane: Original Document */}
        <Card className="flex flex-col">
          <CardHeader className="border-b py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Original Handbook Content
              </CardTitle>
              <span className="text-[11px] text-muted-foreground">
                {docText ? `${docText.split(/\s+/).length} words` : "No document loaded"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-3">
            <Textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="Upload a handbook file above or paste handbook text here…"
              className="min-h-[380px] flex-1 resize-none scroll-area-thin font-mono text-xs leading-relaxed"
            />
          </CardContent>
        </Card>

        {/* Right Pane: Translated Output */}
        <Card className="flex flex-col">
          <CardHeader className="border-b py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Translated Handbook ({targetLang.toUpperCase()})
              </CardTitle>
              {translatedText && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={copy}>
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={downloadTranslated}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => onSendToChat(translatedText, fileName ? `Translated: ${fileName}` : "Translated Handbook")}
                  >
                    <MessagesSquare className="h-3.5 w-3.5" /> Chat with this
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-3">
            {translatedText ? (
              <pre className="min-h-[380px] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/20 p-3 font-mono text-xs leading-relaxed scroll-area-thin">
                {translatedText}
              </pre>
            ) : (
              <div className="flex min-h-[380px] flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/10 text-center p-6 text-xs text-muted-foreground">
                {translating ? (
                  <div className="space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    <p>Translating multi-page handbook sections with IndicTrans2…</p>
                  </div>
                ) : (
                  "Click 'Translate Entire Handbook' above. The translated handbook will appear here side-by-side with original text."
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main View Component                                                */
/* ------------------------------------------------------------------ */

export function DocumentChatView() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<ChatSessionDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sending, setSending] = useState(false);
  const [speakReply, setSpeakReply] = useState(true);
  const [docOpen, setDocOpen] = useState(false);
  const [mainTab, setMainTab] = useState<string>("chat");

  // Recording state
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const newSessionTitleRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: "n" focuses the new-session title input (when not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        newSessionTitleRef.current?.focus();
        newSessionTitleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/chat/sessions", { cache: "no-store" });
      const data = (await res.json()) as { sessions: SessionSummary[] };
      setSessions(data.sessions ?? []);
    } catch {
      toast.error("Could not load sessions");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Session not found");
      const data = (await res.json()) as ChatSessionDetail;
      setActive(data);
    } catch {
      toast.error("Could not load conversation");
      setActive(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Auto-scroll messages on update.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages.length, sending]);

  // Release mic on unmount.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const selectSession = (id: string) => {
    setActiveId(id);
    void loadDetail(id);
  };

  const handleCreated = (id: string) => {
    void loadList();
    selectSession(id);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      if (activeId === id) {
        setActiveId(null);
        setActive(null);
      }
      toast.success("Session deleted");
      void loadList();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ----- voice recording ----- */
  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Microphone not supported", { description: "Use a modern browser or upload a voice file." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "voice.webm", { type: "audio/webm" });
        void sendVoice(file);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone permission denied", { description: "Falling back to text input." });
    }
  }, []);

  const toggleRecord = () => {
    if (recording) stopRecording();
    else void startRecording();
  };

  /* ----- message sending ----- */
  const sendText = async (question: string) => {
    if (!active) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/sessions/${active.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, speak: speakReply }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      await loadDetail(active.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const sendVoice = async (file: File) => {
    if (!active) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append("audio", file, file.name);
      form.append("speak", speakReply ? "true" : "false");
      const res = await fetch(`/api/chat/sessions/${active.id}/messages`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast.success("Voice sent");
      await loadDetail(active.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice upload failed");
    } finally {
      setSending(false);
    }
  };

  const handleSendHandbookToChat = async (text: string, title: string) => {
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          sourceLang: "mr",
          targetLang: "mr",
          documentText: text,
        }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const { id } = (await res.json()) as { id: string };
      setMainTab("chat");
      handleCreated(id);
      toast.success("Loaded translated handbook into chat session!");
    } catch {
      toast.error("Failed to start chat with translated handbook");
    }
  };

  const targetLabel = useMemo(
    () => (active ? languageLabel(active.targetLang) : ""),
    [active],
  );

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={MessagesSquare}
        title="Document Intelligence & Handbook Suite"
        nativeTitle="दस्तऐवज संभाषण व पुस्तिका भाषांतर"
        subtitle="Translate multi-page handbooks or ask questions about your documents by text or voice."
      />

      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="chat" className="gap-2">
            <MessagesSquare className="h-4 w-4" /> Ask / Chat with Document
          </TabsTrigger>
          <TabsTrigger value="handbook" className="gap-2">
            <BookOpen className="h-4 w-4" /> Handbook PDF Translator
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Chat with Document */}
        <TabsContent value="chat" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            {/* LEFT — new session + sessions list */}
            <div className={cn("space-y-4", active && "hidden lg:block")}>
              <NewSessionForm onCreated={handleCreated} titleRef={newSessionTitleRef} />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recent chats</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  {loadingList ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : sessions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No chats yet. Create one to begin.
                    </p>
                  ) : (
                    <div className="max-h-[40vh] space-y-0.5 overflow-y-auto scroll-area-thin lg:max-h-[50vh]">
                      {sessions.map((s) => (
                        <SessionListItem
                          key={s.id}
                          session={s}
                          active={s.id === activeId}
                          onSelect={() => selectSession(s.id)}
                          onDelete={() => void handleDelete(s.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT — conversation */}
            <div className={cn(!active && "hidden lg:block")}>
              {!active ? (
                <EmptyState
                  icon={MessageCircle}
                  title="No conversation selected"
                  description="Start a new chat from the panel on the left, or pick a recent chat to continue."
                  className="h-full min-h-[400px]"
                />
              ) : (
                <Card className="flex h-[calc(100vh-220px)] min-h-[520px] flex-col">
                  {/* conversation header */}
                  <div className="flex items-center gap-2 border-b p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 lg:hidden"
                      onClick={() => {
                        setActive(null);
                        setActiveId(null);
                      }}
                      aria-label="Back"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{active.title}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {active.documentName && (
                          <span className="flex items-center gap-0.5">
                            <FileText className="h-3 w-3" /> {active.documentName}
                          </span>
                        )}
                        <span aria-hidden>·</span>
                        <span className="devanagari">{languageNative(active.sourceLang)}</span>
                        <span aria-hidden>→</span>
                        <span className="devanagari">{languageNative(active.targetLang)}</span>
                      </p>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Volume2 className="h-3 w-3" /> {targetLabel}
                    </Badge>
                  </div>

                  {/* collapsible document */}
                  {active.documentText && (
                    <Collapsible open={docOpen} onOpenChange={setDocOpen} className="border-b">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between rounded-none px-3 text-xs">
                          <span className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" /> View document context
                          </span>
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", docOpen && "rotate-180")} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ScrollArea className="h-40 px-3">
                          <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                            {active.documentText}
                          </pre>
                        </ScrollArea>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* messages */}
                  <div ref={messagesScrollRef} className="flex-1 space-y-4 overflow-y-auto scroll-area-thin p-4">
                    {loadingDetail ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading conversation…
                      </div>
                    ) : active.messages.length === 0 ? (
                      <EmptyState
                        icon={MessagesSquare}
                        title="Ask your first question"
                        description="Type below or tap the mic to speak. The assistant will answer based on your document."
                        className="h-full border-none"
                      />
                    ) : (
                      <>
                        {active.messages.map((m) => (
                          <MessageBubble key={m.id} message={m} sessionId={active.id} />
                        ))}
                        {sending && <TypingIndicator />}
                      </>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* input bar */}
                  <Separator />
                  <div className="p-3">
                    <InputBar
                      disabled={sending || loadingDetail}
                      recording={recording}
                      sending={sending}
                      speakReply={speakReply}
                      onSpeakChange={setSpeakReply}
                      onSendText={(t) => void sendText(t)}
                      onToggleRecord={toggleRecord}
                      onVoiceFile={(f) => void sendVoice(f)}
                    />
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Multipage Handbook Translator */}
        <TabsContent value="handbook" className="space-y-4">
          <HandbookTranslator onSendToChat={handleSendHandbookToChat} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
