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

const HardwareOracle = () => {
  const [ram, setRam] = useState<string>("16");
  const [storage, setStorage] = useState<string>("512");
  const [activeConfig, setActiveConfig] = useState<{
    asr: string;
    trans: string;
    ram: string;
    storage: string;
  }>({
    asr: "whisper-large-v3-turbo",
    trans: "indictrans2-320m",
    ram: "16",
    storage: "512",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("vaaksetu_hardware_config");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.ram) setRam(parsed.ram);
        if (parsed.storage) setStorage(parsed.storage);
        setActiveConfig(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const ramNum = parseInt(ram, 10) || 16;
  const storageNum = parseInt(storage, 10) || 512;

  // Compute recommendation
  let asrRecommendation = "Whisper Large v3 Turbo (SOTA ASR)";
  let asrId = "whisper-large-v3-turbo";
  let transRecommendation = "IndicTrans2 320M (ai4bharat/indictrans2-indic-indic-dist-320M)";
  let transId = "indictrans2-320m";
  let tierLabel = "⚡ Standard Balanced Tier (Recommended)";
  let tierDesc = "Perfect balance of state-of-the-art translation accuracy and low latency.";
  let footprint = "3.2 GB RAM / 4.8 GB SSD";

  if (ramNum >= 32) {
    asrRecommendation = "Whisper Large v3 Turbo (Full Precision)";
    asrId = "whisper-large-v3-turbo";
    transRecommendation = "IndicTrans2 320M + IndicTrans2 1B (Ultra High-Fidelity)";
    transId = "indictrans2-320m";
    tierLabel = "🚀 High Performance Tier";
    tierDesc = "Maximum throughput for simultaneous multi-hour video dubbing and batch translation.";
    footprint = "6.5 GB RAM / 8.2 GB SSD";
  } else if (ramNum <= 8) {
    asrRecommendation = "Whisper Small / Medium (Quantized int8)";
    asrId = "whisper-small";
    transRecommendation = "IndicTrans2 320M (Offloaded/Quantized)";
    transId = "indictrans2-320m";
    tierLabel = "🌱 Resource-Saver Tier";
    tierDesc = "Optimized for 8 GB RAM machines with automatic sequential model offloading.";
    footprint = "2.1 GB RAM / 3.0 GB SSD";
  }

  const applyConfiguration = () => {
    const config = {
      asr: asrId,
      trans: transId,
      ram,
      storage,
      tierLabel,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("vaaksetu_hardware_config", JSON.stringify(config));
    } catch {
      // ignore
    }
    setActiveConfig(config);
    setSaved(true);
    toast.success(`Active configuration updated: ${asrRecommendation} + ${transRecommendation}`);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Hardware Model Oracle
            </CardTitle>
            <CardDescription className="text-xs">
              Select your system&apos;s available RAM and SSD storage. The Oracle automatically selects the optimal Whisper and IndicTrans2 model combination.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[11px] text-primary">
            Active: {activeConfig.asr.replace("whisper-", "").toUpperCase()} + {activeConfig.trans.replace("-320m", " 320M").toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="System RAM">
            <Select value={ram} onValueChange={setRam}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8 GB RAM (Entry Level)</SelectItem>
                <SelectItem value="16">16 GB RAM (Standard / Default)</SelectItem>
                <SelectItem value="24">24 GB RAM (High Memory)</SelectItem>
                <SelectItem value="32">32 GB RAM (Pro Workstation)</SelectItem>
                <SelectItem value="64">64 GB+ RAM (Enterprise)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Storage SSD">
            <Select value={storage} onValueChange={setStorage}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="256">256 GB SSD</SelectItem>
                <SelectItem value="512">512 GB SSD (Standard)</SelectItem>
                <SelectItem value="1024">1 TB SSD</SelectItem>
                <SelectItem value="2048">2 TB+ SSD</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Target Execution Mode">
            <div className="flex h-8 items-center rounded-md border bg-muted/30 px-3 text-xs text-muted-foreground">
              Local On-Premises (Offline SOTA)
            </div>
          </Field>
        </div>

        {/* Oracle Recommendation Card */}
        <div className="space-y-3 rounded-xl border border-primary/30 bg-background/80 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Oracle Recommended Configuration
              </span>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Est. Footprint: {footprint}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                ASR & Transcription Model
              </p>
              <p className="mt-1 font-medium text-sm text-foreground">{asrRecommendation}</p>
              <p className="text-[11px] text-muted-foreground">Faster-Whisper int8 / GPU float16</p>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Translation Model
              </p>
              <p className="mt-1 font-medium text-sm text-foreground">{transRecommendation}</p>
              <p className="text-[11px] text-muted-foreground">22 Indian languages + English</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-muted-foreground">
              <strong>{tierLabel}:</strong> {tierDesc}
            </p>
            <Button
              onClick={applyConfiguration}
              size="sm"
              className="gap-1.5 shadow-sm"
            >
              <ShieldCheck className="h-4 w-4" />
              {saved ? "Applied!" : "Apply & Use This Combination"}
            </Button>
          </div>
        </div>
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
        subtitle="Open-source models powering VaakSetu — and the auto-selection logic that picks the best one."
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
              <span className="font-mono text-xs">gemini</span> adapter is swapped for{" "}
              <strong>IndicTrans2 / Whisper / AI4Bharat TTS</strong> — no code above the adapter layer changes.
            </p>
          </div>
        </CardContent>
      </Card>

      <HardwareOracle />

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
