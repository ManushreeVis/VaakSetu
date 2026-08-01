"use client";

import { useEffect, useState } from "react";
import {
  Cpu,
  BrainCircuit,
  Mic,
  Volume2,
  Languages,
  Sparkles,
  Gauge,
  HardDrive,
  ShieldCheck,
  Play,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader } from "../shared/view-header";
import { ModelBadge } from "../shared/model-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MODEL_REGISTRY,
  type EngineRole,
  type ModelDescriptor,
} from "@/lib/domain/models";
import { LANGUAGE_LIST } from "@/lib/domain/languages";

const ROLE_META: Record<EngineRole, { label: string; icon: LucideIcon; color: string }> = {
  translation: { label: "Translation", icon: Languages, color: "bg-primary/10 text-primary" },
  transcription: {
    label: "Transcription",
    icon: Mic,
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  tts: {
    label: "Text-to-speech",
    icon: Volume2,
    color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  llm: { label: "LLM", icon: BrainCircuit, color: "bg-accent text-accent-foreground" },
};

const MetricBar = ({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) => (
  <div>
    <div className="mb-1 flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <span className="font-mono">{Math.round(value * 100)}%</span>
    </div>
    <Progress value={value * 100} className="h-1.5" />
  </div>
);

const ModelCard = ({ model }: { model: ModelDescriptor }) => {
  const role = ROLE_META[model.role];
  const RoleIcon = role.icon;
  const isPrimary = model.id === "indictrans2";
  return (
    <Card className={isPrimary ? "border-primary/50 shadow-sm" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${role.color}`}>
              <RoleIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span className="truncate">{model.name}</span>
                {isPrimary && (
                  <Badge className="bg-primary text-[10px] text-primary-foreground">Primary</Badge>
                )}
              </CardTitle>
              <p className="truncate text-xs text-muted-foreground">{model.provider}</p>
            </div>
          </div>
          {model.available ? (
            <Badge
              variant="outline"
              className="border-emerald-500/30 text-[11px] text-emerald-700 dark:text-emerald-300"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              Offline
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{model.note}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="font-mono text-[10px]">{model.license}</Badge>
          <Badge variant="outline" className="text-[10px]">{role.label}</Badge>
        </div>

        <Separator />

        <div className="space-y-2">
          <MetricBar icon={Sparkles} label="Quality" value={model.quality} />
          <MetricBar icon={Gauge} label="Speed" value={model.speed} />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" /> {model.footprintGb} GB
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Languages className="h-3.5 w-3.5" /> {model.languages.length} langs
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {model.languages.map((l) => (
            <Badge key={l} variant="secondary" className="font-mono text-[10px] uppercase">
              {l}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

const AutoSelectSimulator = () => {
  const [role, setRole] = useState<EngineRole>("translation");
  const [sourceLang, setSourceLang] = useState("mr");
  const [targetLang, setTargetLang] = useState("en");
  const [durationSec, setDurationSec] = useState("120");
  const [textLength, setTextLength] = useState("500");
  const [result, setResult] = useState<{ modelId: string; reason: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/models/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          sourceLang,
          targetLang,
          durationSec: role === "transcription" ? Number(durationSec) || 0 : undefined,
          textLength: Number(textLength) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { modelId: string; reason: string };
      setResult(data);
    } catch {
      toast.error("Auto-select failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Auto-select simulator
        </CardTitle>
        <CardDescription className="text-xs">
          Tweak the task parameters and see which model the ModelSelector service picks — and why.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Role">
            <Select value={role} onValueChange={(v) => setRole(v as EngineRole)}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="translation">Translation</SelectItem>
                <SelectItem value="transcription">Transcription</SelectItem>
                <SelectItem value="tts">Text-to-speech</SelectItem>
                <SelectItem value="llm">LLM</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Source lang">
            <Select value={sourceLang} onValueChange={setSourceLang}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_LIST.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Target lang">
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_LIST.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {role === "transcription" ? (
            <Field label="Duration (sec)">
              <Input
                type="number"
                min={0}
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                className="h-8"
              />
            </Field>
          ) : (
            <Field label="Text length">
              <Input
                type="number"
                min={0}
                value={textLength}
                onChange={(e) => setTextLength(e.target.value)}
                className="h-8"
              />
            </Field>
          )}
        </div>

        <Button onClick={() => void run()} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run auto-select
        </Button>

        {result && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Selected model
              </span>
              {result.modelId ? (
                <ModelBadge modelId={result.modelId} />
              ) : (
                <Badge variant="destructive" className="text-[11px]">None available</Badge>
              )}
            </div>
            <p className="text-sm leading-relaxed">{result.reason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export function ModelsView() {
  const [models, setModels] = useState<ModelDescriptor[]>(MODEL_REGISTRY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d: { models?: ModelDescriptor[] }) => {
        if (d.models && d.models.length) setModels(d.models);
      })
      .catch(() => {
        /* fall back to bundled registry */
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Cpu}
        title="Models & Auto-Select"
        nativeTitle="प्रारूपे व स्वयंचलित निवड"
        subtitle="Open-source models powering BhashaSetu — and the auto-selection logic that picks the best one."
      />

      <Card className="border-emerald-500/30 bg-emerald-500/[0.04]">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium">Open-source & on-premises by design</p>
            <p className="text-muted-foreground">
              All models below are open-source (MIT) and run fully on-premises. In production the demo&apos;s{" "}
              <span className="font-mono text-xs">z-ai</span> adapter is swapped for{" "}
              <strong>IndicTrans2 / Whisper / AI4Bharat TTS</strong> — no code above the adapter layer changes.
            </p>
          </div>
        </CardContent>
      </Card>

      <AutoSelectSimulator />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Model registry
          </h2>
          <span className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${models.length} models`}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {models.map((m) => (
            <ModelCard key={m.id} model={m} />
          ))}
        </div>
      </section>
    </div>
  );
}
