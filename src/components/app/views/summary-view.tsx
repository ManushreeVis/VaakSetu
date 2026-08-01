"use client";

import { useState } from "react";
import { ScrollText, List, AlignLeft, Copy, Volume2, Loader2, Sparkles, Check } from "lucide-react";
import { ViewHeader } from "../shared/view-header";
import { LanguageSelect } from "../shared/language-select";
import { ModelBadge } from "../shared/model-badge";
import { AudioPlayer } from "../shared/audio-player";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAppStore } from "../app-store";

type Style = "bullets" | "paragraph";
type Length = "short" | "medium" | "detailed";

interface SummaryResponse {
  summary: string;
  model: string;
  wordCount: number;
  jobId: string;
}

const SAMPLE =
  "Agriculture is the backbone of rural India, employing nearly half the country's workforce. " +
  "Small and marginal farmers, owning less than two hectares, account for over 86% of all farmers. " +
  "Timely access to accurate weather forecasts, affordable credit, and modern inputs such as improved " +
  "seeds can dramatically improve yields. Initiatives like soil health cards, micro-irrigation subsidies " +
  "and farmer-producer organisations are helping smallholders move from subsistence to commercial farming. " +
  "Yet challenges persist — fragmented landholdings, climate volatility, post-harvest losses and limited " +
  "market access. Bridging these gaps through digital advisory, collective bargaining and cold-chain " +
  "infrastructure is essential for doubling farmer incomes and securing food for the subcontinent.";

const LENGTHS: { value: Length; label: string; hint: string }[] = [
  { value: "short", label: "Short", hint: "≈ 3-4 points" },
  { value: "medium", label: "Medium", hint: "≈ 6-8 points" },
  { value: "detailed", label: "Detailed", hint: "≈ 10-14 points" },
];

const isBulletText = (text: string): boolean => /^(\s*[-•]\s+)/m.test(text);

const splitBullets = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean);

function SummaryBody({ text }: { text: string }) {
  if (isBulletText(text)) {
    const items = splitBullets(text);
    return (
      <ul className="list-disc space-y-1.5 pl-5 marker:text-primary">
        {items.map((it, i) => (
          <li key={i} className="text-sm leading-relaxed">{it}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split(/\r?\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function SummaryView() {
  const { defaultSourceLang, defaultTargetLang, setDefaultSourceLang, setDefaultTargetLang } = useAppStore();
  const [source, setSource] = useState(defaultSourceLang);
  const [target, setTarget] = useState(defaultTargetLang);
  const [style, setStyle] = useState<Style>("bullets");
  const [length, setLength] = useState<Length>("medium");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPath, setTtsPath] = useState<{ jobId: string; name: string } | null>(null);

  const summarize = async () => {
    if (!input.trim()) {
      toast.error("Enter some text to summarize.");
      return;
    }
    setLoading(true);
    setResult(null);
    setTtsPath(null);
    setDefaultSourceLang(source);
    setDefaultTargetLang(target);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, sourceLang: source, targetLang: target, style, length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Summarization failed");
      setResult(data as SummaryResponse);
      toast.success(`Summarized — ${data.wordCount} words`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Summarization failed");
    } finally {
      setLoading(false);
    }
  };

  const speak = async () => {
    if (!result) return;
    setTtsLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result.summary, language: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "TTS failed");
      const segs = String(data.path).split("/").filter(Boolean);
      setTtsPath({ name: segs[segs.length - 1], jobId: segs[segs.length - 2] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "TTS failed");
    } finally {
      setTtsLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={ScrollText}
        title="Summarize"
        nativeTitle="सारांश"
        subtitle="Condense any text into a concise summary in your language — bullets or paragraph."
      />

      {/* Language + options */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-5 p-4 md:grid-cols-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">From</Label>
              <LanguageSelect variant="source" value={source} onChange={setSource} className="w-full" />
            </div>
            <span className="pb-2.5 text-muted-foreground">→</span>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">To</Label>
              <LanguageSelect variant="target" value={target} onChange={setTarget} className="w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <List className="h-3.5 w-3.5" /> Style
              </Label>
              <RadioGroup className="flex gap-2" value={style} onValueChange={(v) => setStyle(v as Style)}>
                {[
                  { v: "bullets" as const, l: "Bullets", Icon: List },
                  { v: "paragraph" as const, l: "Paragraph", Icon: AlignLeft },
                ].map(({ v, l, Icon }) => (
                  <Label
                    key={v}
                    htmlFor={`style-${v}`}
                    className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <RadioGroupItem value={v} id={`style-${v}`} />
                    <Icon className="h-3.5 w-3.5" />
                    {l}
                  </Label>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground">Length</Label>
              <Select value={length} onValueChange={(v) => setLength(v as Length)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LENGTHS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-baseline gap-2">
                        <span className="font-medium">{o.label}</span>
                        <span className="text-xs text-muted-foreground">{o.hint}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Input */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Text to summarize</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => { setInput(SAMPLE); setResult(null); setTtsPath(null); }}
              >
                <Sparkles className="h-3.5 w-3.5" /> Paste sample
              </Button>
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste an article, transcript, or any long text here…"
              className="min-h-[220px] flex-1 resize-none text-base"
              lang={source === "auto" ? undefined : source}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{input.length} characters</span>
              <Button onClick={summarize} disabled={loading || !input.trim()} className="gap-1.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
                Summarize
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Summary</Label>
              {result && <ModelBadge modelId={result.model} />}
            </div>
            {loading ? (
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : result ? (
              <div
                className="scroll-area-thin min-h-[220px] max-h-[420px] flex-1 overflow-y-auto rounded-lg border bg-muted/30 p-4"
                lang={target}
              >
                <SummaryBody text={result.summary} />
              </div>
            ) : (
              <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
                Your summary will appear here.
              </div>
            )}
            {result && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{result.wordCount} words</span>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={copy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  Copy
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={speak} disabled={ttsLoading}>
                  {ttsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                  Generate voice
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {ttsPath && (
        <Card>
          <CardContent className="p-4">
            <AudioPlayer src={`/api/download/${ttsPath.jobId}/${ttsPath.name}`} label="Summary voice (WAV)" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
