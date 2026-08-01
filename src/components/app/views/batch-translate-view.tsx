"use client";

import { useState } from "react";
import {
  Layers,
  ArrowRight,
  Loader2,
  Download,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { ViewHeader } from "../shared/view-header";
import { LanguageSelect } from "../shared/language-select";
import { ModelBadge } from "../shared/model-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAppStore } from "../app-store";

interface BatchItem {
  source: string;
  target: string;
  ok: boolean;
  error?: string;
}

interface BatchResult {
  items: BatchItem[];
  model: string;
  modelReason: string;
  jobId: string;
  succeeded: number;
  failed: number;
}

const SAMPLE_LINES = [
  "Please submit the application form before the deadline.",
  "The training session will be held at the village community hall.",
  "Farmers can receive subsidies for drip irrigation equipment.",
  "Bring your Aadhaar card and bank passbook to the meeting.",
  "The cooperative will distribute seeds next Monday.",
];

export function BatchTranslateView() {
  const { defaultSourceLang, defaultTargetLang, setDefaultSourceLang, setDefaultTargetLang } = useAppStore();
  const [source, setSource] = useState(defaultSourceLang);
  const [target, setTarget] = useState(defaultTargetLang);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<BatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = input.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const translate = async () => {
    if (lines.length === 0) {
      toast.error("Enter at least one line to translate.");
      return;
    }
    setLoading(true);
    setResult(null);
    setDefaultSourceLang(source);
    setDefaultTargetLang(target);
    try {
      const res = await fetch("/api/translate/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: lines, sourceLang: source, targetLang: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Batch translation failed");
      setResult(data as BatchResult);
      toast.success(`Translated ${data.succeeded}/${data.items.length} lines`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch translation failed");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.items.map((i) => i.target).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadCsv = () => {
    if (!result) return;
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [["#", "source", "target", "status"].join(",")];
    result.items.forEach((it, idx) => {
      rows.push([String(idx + 1), escape(it.source), escape(it.target), it.ok ? "ok" : "failed"].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-${target}-${result.jobId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const useSample = () => {
    setInput(SAMPLE_LINES.join("\n"));
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Layers}
        title="Batch Translation"
        nativeTitle="साखळी भाषांतर"
        subtitle="Translate many lines at once — perfect for field surveys, notices and lists. Up to 200 lines per batch."
      />

      {/* Language bar */}
      <Card>
        <CardContent className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs text-muted-foreground">From</Label>
            <LanguageSelect variant="source" value={source} onChange={setSource} className="w-full" />
          </div>
          <div className="hidden items-end justify-center sm:flex">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
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
              <Label className="text-xs text-muted-foreground">Input — one sentence per line</Label>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={useSample}>
                <Sparkles className="h-3.5 w-3.5" /> Sample
              </Button>
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"Enter one sentence per line…\n\nEach non-empty line is translated separately and appears as a row in the results table."}
              className="min-h-[260px] flex-1 resize-none font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{lines.length} line(s) ready</span>
              <Button onClick={translate} disabled={loading || lines.length === 0} className="gap-1.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                Translate batch
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Results</Label>
              {result && <ModelBadge modelId={result.model} />}
            </div>

            {loading && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Translating {lines.length} lines…</p>
                <Progress className="mt-2 w-2/3" />
              </div>
            )}

            {!loading && !result && (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-16 text-sm text-muted-foreground">
                Translated lines will appear here as a table.
              </div>
            )}

            {!loading && result && (
              <>
                {/* Summary strip */}
                <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                  <span className="flex items-center gap-1.5 font-medium text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> {result.succeeded} succeeded
                  </span>
                  {result.failed > 0 && (
                    <span className="flex items-center gap-1.5 font-medium text-destructive">
                      <XCircle className="h-4 w-4" /> {result.failed} failed
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">job {result.jobId.slice(-8)}</span>
                </div>

                {/* Results table */}
                <div className="max-h-[340px] overflow-y-auto scroll-area-thin rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="w-10 px-2 py-2 font-medium">#</th>
                        <th className="px-2 py-2 font-medium">Source</th>
                        <th className="px-2 py-2 font-medium">Translation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((it, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-2 align-top text-muted-foreground">{idx + 1}</td>
                          <td className="px-2 py-2 align-top">{it.source}</td>
                          <td className="px-2 py-2 align-top" lang={target}>
                            {it.ok ? (
                              it.target
                            ) : (
                              <span className="flex items-center gap-1 text-destructive">
                                <AlertCircle className="h-3.5 w-3.5" /> {it.error ?? "failed"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={copyAll}>
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    Copy all
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadCsv}>
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto gap-1.5"
                    onClick={() => { setResult(null); setInput(""); }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Clear
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
