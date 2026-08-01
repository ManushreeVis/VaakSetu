"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Wand2,
  Database,
  Plus,
  Trash2,
  Play,
  Terminal,
  Loader2,
  CheckCircle2,
  Layers,
  FileText,
  FlaskConical,
} from "lucide-react";
import { ViewHeader } from "../shared/view-header";
import { LanguageSelect } from "../shared/language-select";
import { EmptyState } from "../shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { modelsByRole } from "@/lib/domain/models";
import { languageLabel, languageNative } from "@/lib/domain/languages";

// ----- Types -----
interface Sample {
  id: string;
  source: string;
  target: string;
}
interface Job {
  id: string;
  datasetId: string;
  baseModel: string;
  status: string;
  progress: number;
  epochs: number;
  learningRate: number;
  batchSize: number;
  outputRef?: string | null;
  log?: string | null;
  createdAt: string;
  updatedAt: string;
}
interface Dataset {
  id: string;
  name: string;
  sourceLang: string;
  targetLang: string;
  description?: string | null;
  samples: Sample[];
  jobs: Job[];
  createdAt: string;
}
interface DatasetListItem {
  id: string;
  name: string;
  sourceLang: string;
  targetLang: string;
  description?: string | null;
  _count: { samples: number; jobs: number };
  createdAt: string;
}

const TRANSLATION_MODELS = modelsByRole("translation");

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  running: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  failed: "bg-destructive/15 text-destructive",
  queued: "bg-muted text-muted-foreground",
};

const parseBulk = (text: string): { source: string; target: string }[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [src, ...rest] = l.split(/\s*\|\|\|\s*/);
      return { source: (src ?? "").trim(), target: rest.join(" ||| ").trim() };
    })
    .filter((p) => p.source && p.target);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });

// ----- New Dataset Dialog -----
const NewDatasetDialog = ({ onCreated }: { onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("hi");
  const [description, setDescription] = useState("");
  const [bulk, setBulk] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setSourceLang("en");
    setTargetLang("hi");
    setDescription("");
    setBulk("");
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Dataset name is required.");
      return;
    }
    const samples = parseBulk(bulk);
    setSubmitting(true);
    try {
      const res = await fetch("/api/finetune/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sourceLang, targetLang, description, samples }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create dataset");
      toast.success(`Dataset created with ${samples.length} sample pair(s).`);
      reset();
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create dataset");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> New dataset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" /> New parallel-sentence dataset
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ds-name">Name</Label>
            <Input
              id="ds-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Agriculture extension corpus"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <LanguageSelect variant="source" value={sourceLang} onChange={setSourceLang} className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <LanguageSelect variant="target" value={targetLang} onChange={setTargetLang} className="w-full" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-desc">
              Description <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="ds-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Domain, source, etc."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-bulk">
              Bulk sample pairs <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="ds-bulk"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"One per line: source ||| target"}
              className="min-h-[100px] font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              {parseBulk(bulk).length} pair(s) detected.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create dataset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ----- Training Log Dialog -----
const JobLogDialog = ({ job, onClose }: { job: Job | null; onClose: () => void }) => (
  <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          Training log · {job ? job.id.slice(-6) : ""}
        </DialogTitle>
      </DialogHeader>
      <ScrollArea className="h-80 rounded-lg border bg-zinc-950">
        <pre className="whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
{job?.log?.trim() || "(No log output yet — waiting for the training loop to start…)"}
        </pre>
      </ScrollArea>
      <DialogFooter>
        {job && (
          <Badge variant="outline" className="mr-auto gap-1 text-[11px]">
            {job.status}
          </Badge>
        )}
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

// ----- Jobs Panel -----
const JobsPanel = ({ jobs, onLog }: { jobs: Job[]; onLog: (j: Job) => void }) => {
  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No training jobs yet"
        description="Start a fine-tune run above to see live progress here."
      />
    );
  }
  return (
    <div className="space-y-3">
      {jobs.map((j) => {
        const active = j.status === "queued" || j.status === "running";
        return (
          <div key={j.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`gap-1 text-[11px] ${STATUS_STYLE[j.status] ?? STATUS_STYLE.queued}`}>
                {j.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Base: <span className="font-mono">{j.baseModel}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                · {j.epochs} ep · lr {j.learningRate} · bs {j.batchSize}
              </span>
              {j.outputRef && (
                <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {j.outputRef}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto gap-1 text-xs"
                onClick={() => onLog(j)}
              >
                <Terminal className="h-3.5 w-3.5" /> View log
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Progress value={j.progress} className="h-2 flex-1" />
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                {j.progress}%
              </span>
              {active && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Started {fmtDate(j.createdAt)}</p>
          </div>
        );
      })}
    </div>
  );
};

// ----- Dataset Detail -----
const DatasetDetail = ({
  dataset,
  onChanged,
}: {
  dataset: Dataset;
  onChanged: () => void;
}) => {
  const [addSrc, setAddSrc] = useState("");
  const [addTgt, setAddTgt] = useState("");
  const [bulk, setBulk] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [baseModel, setBaseModel] = useState("indictrans2");
  const [epochs, setEpochs] = useState(3);
  const [lr, setLr] = useState("0.0001");
  const [bs, setBs] = useState("16");
  const [starting, setStarting] = useState(false);
  const [logJobId, setLogJobId] = useState<string | null>(null);

  const logJob = dataset.jobs.find((j) => j.id === logJobId) ?? null;

  const addPair = async () => {
    if (!addSrc.trim() || !addTgt.trim()) {
      toast.error("Both source and target are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/finetune/datasets/${dataset.id}/samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: [{ source: addSrc.trim(), target: addTgt.trim() }] }),
      });
      if (!res.ok) throw new Error("Failed to add sample");
      setAddSrc("");
      setAddTgt("");
      toast.success("Sample added.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add sample");
    } finally {
      setBusy(false);
    }
  };

  const addBulk = async () => {
    const pairs = parseBulk(bulk);
    if (pairs.length === 0) {
      toast.error("No valid pairs. Use format: source ||| target");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/finetune/datasets/${dataset.id}/samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: pairs }),
      });
      if (!res.ok) throw new Error("Failed to add samples");
      setBulk("");
      setBulkOpen(false);
      toast.success(`Added ${pairs.length} pair(s).`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add samples");
    } finally {
      setBusy(false);
    }
  };

  const startTraining = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/finetune/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: dataset.id,
          baseModel,
          epochs,
          learningRate: Number(lr),
          batchSize: Number(bs),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to start training");
      toast.success("Training started.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start training");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-primary" /> {dataset.name}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {languageLabel(dataset.sourceLang)} ({languageNative(dataset.sourceLang)}) →{" "}
              {languageLabel(dataset.targetLang)} ({languageNative(dataset.targetLang)}) ·{" "}
              {dataset.samples.length} sample pair(s)
            </p>
            {dataset.description && (
              <p className="mt-1 text-sm text-muted-foreground">{dataset.description}</p>
            )}
          </div>
          <Badge variant="outline" className="text-[11px]">
            {fmtDate(dataset.createdAt)}
          </Badge>
        </CardHeader>
      </Card>

      {/* Samples */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Parallel sentence pairs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={addSrc}
              onChange={(e) => setAddSrc(e.target.value)}
              placeholder="Source sentence"
              disabled={busy}
            />
            <Input
              value={addTgt}
              onChange={(e) => setAddTgt(e.target.value)}
              placeholder="Target sentence"
              disabled={busy}
            />
            <Button onClick={addPair} disabled={busy} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          {bulkOpen ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder="One per line: source ||| target"
                className="min-h-[90px] font-mono text-xs"
              />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  {parseBulk(bulk).length} pair(s) detected.
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setBulkOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={addBulk} disabled={busy} className="gap-1.5">
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}{" "}
                    Bulk add
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Bulk add pairs
            </Button>
          )}

          {dataset.samples.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No samples yet"
              description="Add parallel sentence pairs above to build your dataset."
            />
          ) : (
            <ScrollArea className="h-72 rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Source ({languageLabel(dataset.sourceLang)})</TableHead>
                    <TableHead>Target ({languageLabel(dataset.targetLang)})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.samples.map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="max-w-xs whitespace-normal">{s.source}</TableCell>
                      <TableCell className="max-w-xs whitespace-normal">{s.target}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Start training */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Play className="h-4 w-4 text-primary" /> Start fine-tune
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Base model</Label>
              <Select value={baseModel} onValueChange={setBaseModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSLATION_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.provider}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Epochs</span>
                <span className="tabular-nums">{epochs}</span>
              </Label>
              <Slider
                value={[epochs]}
                min={1}
                max={10}
                step={1}
                onValueChange={(v) => setEpochs(v[0])}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lr" className="text-xs text-muted-foreground">
                Learning rate
              </Label>
              <Input
                id="lr"
                value={lr}
                onChange={(e) => setLr(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bs" className="text-xs text-muted-foreground">
                Batch size
              </Label>
              <Input
                id="bs"
                value={bs}
                onChange={(e) => setBs(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Sandbox simulates the fairseq loop. See docs/FINE_TUNE.md for the on-prem recipe.
            </p>
            <Button
              onClick={startTraining}
              disabled={starting || dataset.samples.length === 0}
              className="gap-1.5"
            >
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start training
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4 text-primary" /> Training jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <JobsPanel jobs={dataset.jobs} onLog={(j) => setLogJobId(j.id)} />
        </CardContent>
      </Card>

      <JobLogDialog job={logJob} onClose={() => setLogJobId(null)} />
    </div>
  );
};

// ----- Main View -----
export function FinetuneView() {
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Dataset | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDatasets = useCallback(async () => {
    try {
      const res = await fetch("/api/finetune/datasets");
      const data = await res.json();
      setDatasets((data.datasets ?? []) as DatasetListItem[]);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async () => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    try {
      const res = await fetch(`/api/finetune/datasets/${selectedId}`);
      if (!res.ok) {
        setDetail(null);
        return;
      }
      setDetail((await res.json()) as Dataset);
    } catch {
      /* ignore */
    }
  }, [selectedId]);

  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  useEffect(() => {
    setDetailLoading(true);
    void loadDetail().finally(() => setDetailLoading(false));
  }, [loadDetail]);

  // Poll while any job on the selected dataset is queued or running.
  const hasActiveJob =
    detail?.jobs.some((j) => j.status === "queued" || j.status === "running") ?? false;
  useEffect(() => {
    if (!hasActiveJob) return;
    const interval = setInterval(() => {
      void loadDetail();
      void loadDatasets();
    }, 2000);
    return () => clearInterval(interval);
  }, [hasActiveJob, loadDetail, loadDatasets]);

  const deleteDataset = async (id: string) => {
    try {
      const res = await fetch(`/api/finetune/datasets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Dataset deleted.");
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      void loadDatasets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Wand2}
        title="Fine-tune Models"
        nativeTitle="प्रारूप फाइन-ट्यूनिंग"
        subtitle="Adapt IndicTrans2 to your domain with parallel-sentence datasets."
        actions={<NewDatasetDialog onCreated={() => void loadDatasets()} />}
      />

      {/* Info card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <FlaskConical className="h-4 w-4" />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Production recipe.</span>{" "}
            In production, this launches a fairseq fine-tuning run of IndicTrans2 on the uploaded
            parallel corpus (see docs/FINE_TUNE.md). The sandbox simulates the training loop so the
            full UX is exercisable.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* Datasets list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Datasets</h2>
            <Badge variant="secondary" className="text-[11px]">
              {datasets.length}
            </Badge>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : datasets.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No datasets"
              description="Create your first parallel-sentence dataset to begin."
            />
          ) : (
            <div className="space-y-2">
              {datasets.map((d) => {
                const active = d.id === selectedId;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={`group w-full rounded-xl border p-3 text-left transition-all hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active ? "border-primary bg-primary/5" : "bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight">{d.name}</p>
                      <Trash2
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteDataset(d.id);
                        }}
                        className="h-4 w-4 shrink-0 cursor-pointer text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        role="button"
                        aria-label="Delete dataset"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {languageLabel(d.sourceLang)} → {languageLabel(d.targetLang)} ·{" "}
                      {d._count.samples} pairs · {d._count.jobs} jobs
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail */}
        <div>
          {!selectedId ? (
            <EmptyState
              icon={Layers}
              title="Select a dataset"
              description="Pick a dataset on the left to view its parallel pairs and start fine-tuning."
            />
          ) : detailLoading && !detail ? (
            <div className="flex items-center gap-2 rounded-lg border py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading dataset…
            </div>
          ) : detail ? (
            <DatasetDetail
              dataset={detail}
              onChanged={() => {
                void loadDetail();
                void loadDatasets();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
