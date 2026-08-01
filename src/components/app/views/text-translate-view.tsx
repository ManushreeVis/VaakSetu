"use client";

import { useState } from "react";
import { Languages, ArrowRight, Copy, Check, Volume2, Loader2, Sparkles, RotateCcw, BookOpen } from "lucide-react";
import { ViewHeader } from "../shared/view-header";
import { LanguageSelect } from "../shared/language-select";
import { ModelBadge } from "../shared/model-badge";
import { AudioPlayer } from "../shared/audio-player";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAppStore } from "../app-store";

interface GlossaryMatch {
  source: string;
  expected: string;
  applied: boolean;
}

interface TranslateResponse {
  text: string;
  model: string;
  modelReason: string;
  jobId: string;
  glossary?: { matched: GlossaryMatch[]; changed: boolean };
}

const SAMPLES: Record<string, string> = {
  en: "Agriculture is the backbone of rural India. Timely access to weather forecasts helps farmers make better decisions about sowing, irrigation and harvest.",
  hi: "कृषी ग्रामीण भारताचा पाठिंबा आहे. हवामानाच्या अचूक अंदाजामुळे शेतकऱ्यांना पेरणी, ओलितां आणि कापणीविषयी चांगले निर्णय घेता येतात.",
  mr: "शेती हा ग्रामीण भारताचा मुख्य आधार आहे. हवामानाच्या अचूक अंदाजामुळे शेतकऱ्यांना पेरणी, ओलित आणि कापणी याबाबत चांगले निर्णय घेता येतात.",
};

export function TextTranslateView() {
  const { defaultSourceLang, defaultTargetLang, setDefaultSourceLang, setDefaultTargetLang, autoModel, setAutoModel } = useAppStore();
  const [source, setSource] = useState(defaultSourceLang);
  const [target, setTarget] = useState(defaultTargetLang);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ttsPath, setTtsPath] = useState<{ jobId: string; name: string } | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  const swap = () => {
    if (source === "auto") {
      toast.info("Pick a specific source language to swap.");
      return;
    }
    setSource(target);
    setTarget(source);
    if (result) {
      setInput(result.text);
      setResult(null);
    }
  };

  const translate = async () => {
    if (!input.trim()) {
      toast.error("Enter some text to translate.");
      return;
    }
    setLoading(true);
    setResult(null);
    setTtsPath(null);
    setDefaultSourceLang(source);
    setDefaultTargetLang(target);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, sourceLang: source, targetLang: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Translation failed");
      setResult(data as TranslateResponse);
      toast.success("Translated with " + (data as TranslateResponse).model);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Translation failed");
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
        body: JSON.stringify({ text: result.text, language: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "TTS failed");
      setTtsPath({ jobId: data.path.split("/").slice(-2, -1)[0], name: data.path.split("/").pop() });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "TTS failed");
    } finally {
      setTtsLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const useSample = () => {
    setInput(SAMPLES[target] ?? SAMPLES.en);
    setResult(null);
  };

  const charCount = input.length;

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Languages}
        title="Text Translation"
        nativeTitle="मजकूर भाषांतर"
        subtitle="Translate plain text between Marathi, Hindi and English using IndicTrans2."
        actions={
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <Switch id="auto-model" checked={autoModel} onCheckedChange={setAutoModel} />
            <Label htmlFor="auto-model" className="cursor-pointer text-xs">Auto-select model</Label>
          </div>
        }
      />

      {/* Language bar */}
      <Card>
        <CardContent className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs text-muted-foreground">From</Label>
            <LanguageSelect variant="source" value={source} onChange={setSource} className="w-full" />
          </div>
          <div className="flex items-end justify-center">
            <Button variant="outline" size="icon" onClick={swap} className="h-10 w-10 rounded-full" aria-label="Swap languages">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs text-muted-foreground">To</Label>
            <LanguageSelect variant="target" value={target} onChange={setTarget} className="w-full" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Input */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Input text</Label>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={useSample}>
                <Sparkles className="h-3.5 w-3.5" /> Sample
              </Button>
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type or paste text here…"
              className="min-h-[200px] flex-1 resize-none text-base"
              lang={source === "auto" ? undefined : source}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground tabular-nums">
                {charCount} chars · {input.trim() ? input.trim().split(/\s+/).length : 0} words
              </span>
              <Button onClick={translate} disabled={loading || !input.trim()} className="gap-1.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                Translate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Translation</Label>
              {result && <ModelBadge modelId={result.model} />}
            </div>
            <div className="min-h-[200px] flex-1 rounded-lg border bg-muted/30 p-3 text-base whitespace-pre-wrap" lang={target}>
              {result ? result.text : (
                <span className="text-muted-foreground">The translated text will appear here.</span>
              )}
            </div>
            {result && (
              <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                <span>{result.text.length} chars · {result.text.trim() ? result.text.trim().split(/\s+/).length : 0} words</span>
                <span>~{Math.max(1, Math.ceil(result.text.length / 500))} min read</span>
              </div>
            )}
            {result?.modelReason && (
              <p className="text-[11px] text-muted-foreground">{result.modelReason}</p>
            )}
            {result?.glossary && result.glossary.matched.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-primary/5 p-2">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-medium text-primary">Glossary:</span>
                {result.glossary.matched.map((m, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className={`gap-1 text-[10px] ${m.applied ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
                    title={m.applied ? `Applied: ${m.source} → ${m.expected}` : `Already present: ${m.expected}`}
                  >
                    {m.source} → {m.expected}
                    {m.applied && <Check className="h-2.5 w-2.5" />}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copy} disabled={!result}>
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                Copy
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={speak} disabled={!result || ttsLoading}>
                {ttsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                Generate voice
              </Button>
              {result && (
                <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={() => { setResult(null); setInput(""); }}>
                  <RotateCcw className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {ttsPath && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Translated voice</p>
              <Badge variant="secondary" className="ml-auto text-[11px]">AI4Bharat TTS</Badge>
            </div>
            <AudioPlayer src={`/api/download/${ttsPath.jobId}/${ttsPath.name}`} label="Synthesized speech (WAV)" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
