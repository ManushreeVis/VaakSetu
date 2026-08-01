"use client";

import { useEffect, useState } from "react";
import {
  Languages,
  Layers,
  Clapperboard,
  MessagesSquare,
  ScrollText,
  Repeat2,
  BookOpen,
  History,
  Wand2,
  Cpu,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAppStore, type ViewId } from "../app-store";
import { ViewHeader } from "../shared/view-header";
import { StatCard } from "../shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LANGUAGE_LIST } from "@/lib/domain/languages";
import { ALL_MEDIA_FORMATS } from "@/lib/domain/media-formats";
import { ModelBadge } from "../shared/model-badge";
import { ActivityChart } from "../shared/activity-chart";

interface Stats {
  totalJobs: number;
  statusCounts: Record<string, number>;
  kindCounts: Record<string, number>;
  fineTuneDatasets: number;
  fineTuneSamples: number;
  fineTuneJobsRunning: number;
  glossaryCount?: number;
  jobsPerDay?: { day: string; count: number }[];
}

interface JobSummary {
  id: string;
  kind: string;
  status: string;
  sourceLang: string;
  targetLang: string;
  inputName: string | null;
  inputText: string | null;
  outputText: string | null;
  createdAt: string;
  model: string | null;
}

const QUICK_ACTIONS: { view: ViewId; icon: typeof Languages; label: string; native: string; desc: string }[] = [
  { view: "text", icon: Languages, label: "Translate Text", native: "मजकूर", desc: "Marathi · Hindi · English" },
  { view: "batch", icon: Layers, label: "Batch Translate", native: "साखळी", desc: "Many lines at once → CSV" },
  { view: "media", icon: Clapperboard, label: "Translate Audio / Video", native: "ध्वनी / व्हिडिओ", desc: "Speech → text → voice + subtitles" },
  { view: "chat", icon: MessagesSquare, label: "Chat with Document", native: "दस्तऐवज", desc: "Ask questions, by voice or text" },
  { view: "summary", icon: ScrollText, label: "Summarize", native: "सारांश", desc: "Any language, bullets or paragraph" },
  { view: "convert", icon: Repeat2, label: "Convert Formats", native: "स्वरूप", desc: "SRT · VTT · audio transcode" },
  { view: "glossary", icon: BookOpen, label: "Glossary", native: "शब्दकोश", desc: "Consistent domain terminology" },
  { view: "finetune", icon: Wand2, label: "Fine-tune Model", native: "फाइन-ट्यून", desc: "Adapt IndicTrans2 to your domain" },
];

const KIND_LABEL: Record<string, string> = {
  text: "Text",
  media: "Media",
  summary: "Summary",
  convert: "Convert",
};

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  running: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  failed: "bg-destructive/15 text-destructive",
  queued: "bg-muted text-muted-foreground",
  canceled: "bg-muted text-muted-foreground",
};

export function DashboardView() {
  const setView = useAppStore((s) => s.setView);
  const setDefaultSourceLang = useAppStore((s) => s.setDefaultSourceLang);
  const setDefaultTargetLang = useAppStore((s) => s.setDefaultTargetLang);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/jobs?limit=5").then((r) => r.json()),
    ]).then(([s, j]) => {
      setStats(s as Stats);
      setRecent((j as { jobs: JobSummary[] }).jobs ?? []);
      setLoading(false);
    });
  }, []);

  const completed = stats?.statusCounts.completed ?? 0;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="mesh-hero relative overflow-hidden rounded-2xl border p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <Badge className="mb-3 gap-1 bg-primary/15 text-primary hover:bg-primary/15">
            <Sparkles className="h-3 w-3" /> Tech for Good · BAIF
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            BhashaSetu — <span className="devanagari text-primary">भाषासेतु</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-primary devanagari">भाषांचा सेतु बांधणारा</p>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Transcribe, translate and voice <strong>Marathi</strong>, <strong>Hindi</strong> and{" "}
            <strong>English</strong> from text, audio and video — entirely on-premises with
            open-source models. No data ever leaves your infrastructure.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => setView("media")} className="gap-1.5">
              <Clapperboard className="h-4 w-4" /> Translate media
            </Button>
            <Button variant="outline" onClick={() => setView("text")} className="gap-1.5">
              <Languages className="h-4 w-4" /> Translate text
            </Button>
          </div>
          {/* Quick language-pair chips */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Quick:</span>
            {[
              { src: "en", tgt: "hi" },
              { src: "en", tgt: "mr" },
              { src: "hi", tgt: "en" },
              { src: "mr", tgt: "en" },
              { src: "hi", tgt: "mr" },
              { src: "mr", tgt: "hi" },
            ].map((p) => (
              <button
                key={`${p.src}-${p.tgt}`}
                onClick={() => { setDefaultSourceLang(p.src); setDefaultTargetLang(p.tgt); setView("text"); }}
                className="rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
              >
                {p.src} → {p.tgt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Completed jobs" value={loading ? "—" : completed} hint="All-time" animateNumber={!loading} />
        <StatCard icon={History} label="Total jobs" value={loading ? "—" : stats?.totalJobs ?? 0} hint="History" accent="accent" animateNumber={!loading} />
        <StatCard icon={BookOpen} label="Glossary terms" value={loading ? "—" : stats?.glossaryCount ?? 0} hint="Domain terminology" accent="muted" animateNumber={!loading} />
        <StatCard icon={Cpu} label="Models available" value={5} hint="IndicTrans2 · Whisper · TTS · LLM" accent="accent" animateNumber />
      </div>

      {/* Quick actions */}
      <section>
        <ViewHeader icon={Sparkles} title="Start a task" nativeTitle="कार्य सुरू करा" subtitle="Pick a tool to begin" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.view}
                onClick={() => setView(a.view)}
                className="group flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                  <p className="text-[11px] text-primary devanagari">{a.native}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Activity chart */}
      {stats && <ActivityChart data={stats.jobsPerDay ?? []} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent jobs */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setView("history")}>
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : recent.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No jobs yet. Run your first translation to see it here.
              </div>
            ) : (
              <ul className="divide-y">
                {recent.map((job) => (
                  <li key={job.id} className="flex items-center gap-3 px-6 py-3">
                    <Badge variant="outline" className="shrink-0 text-[11px]">
                      {KIND_LABEL[job.kind] ?? job.kind}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {job.inputName ?? (job.inputText?.slice(0, 60) || "Untitled") + (job.inputText && job.inputText.length > 60 ? "…" : "")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {job.sourceLang} → {job.targetLang}
                        {job.model && <span className="ml-2">· {job.model}</span>}
                      </p>
                    </div>
                    <Badge className={`shrink-0 text-[11px] ${STATUS_STYLE[job.status] ?? STATUS_STYLE.queued}`}>
                      {job.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Languages + formats */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Supported languages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {LANGUAGE_LIST.map((l) => (
                <div key={l.code} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.script} · {l.bcp47}</p>
                  </div>
                  <span className="text-lg devanagari" lang={l.code}>{l.nativeName}</span>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">Source supports auto-detect.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Media formats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {ALL_MEDIA_FORMATS.map((f) => (
                  <Badge key={f.ext} variant="secondary" className="font-mono text-[11px] uppercase">
                    {f.ext}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ModelBadge modelId="indictrans2" />
                <ModelBadge modelId="whisper-small" />
                <ModelBadge modelId="ai4bharat-tts" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
