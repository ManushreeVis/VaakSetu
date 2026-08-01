"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Search,
  Loader2,
  Download,
  Upload,
  Pencil,
  Check,
  X,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { ViewHeader } from "../shared/view-header";
import { LanguageSelect } from "../shared/language-select";
import { EmptyState } from "../shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { languageLabel, languageNative } from "@/lib/domain/languages";

interface GlossaryEntry {
  id: string;
  sourceLang: string;
  targetLang: string;
  source: string;
  target: string;
  category: string;
  note: string | null;
  createdAt: string;
}

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "agriculture", label: "Agriculture" },
  { value: "finance", label: "Finance" },
  { value: "health", label: "Health" },
  { value: "government", label: "Government" },
  { value: "technology", label: "Technology" },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-muted text-muted-foreground",
  agriculture: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  finance: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  health: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  government: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  technology: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

export function GlossaryView() {
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterLang, setFilterLang] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [editing, setEditing] = useState<GlossaryEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (filterLang !== "all") {
        const [sl, tl] = filterLang.split("-");
        if (sl) params.set("sourceLang", sl);
        if (tl) params.set("targetLang", tl);
      }
      if (filterCat !== "all") params.set("category", filterCat);
      const res = await fetch(`/api/glossary?${params}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      toast.error("Failed to load glossary.");
    } finally {
      setLoading(false);
    }
  }, [query, filterLang, filterCat]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const remove = async (id: string) => {
    try {
      await fetch(`/api/glossary/${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Entry removed.");
    } catch {
      toast.error("Failed to remove entry.");
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glossary-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Partial<GlossaryEntry>[];
      let ok = 0;
      for (const item of data) {
        if (!item.source || !item.target || !item.sourceLang || !item.targetLang) continue;
        const res = await fetch("/api/glossary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (res.ok) ok++;
      }
      toast.success(`Imported ${ok} of ${data.length} entries.`);
      void load();
    } catch {
      toast.error("Import failed — invalid JSON.");
    }
  };

  const csvCell = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportCsv = () => {
    const headers = ["sourceLang", "targetLang", "source", "target", "category", "note"];
    const rows = entries.map((e) => [e.sourceLang, e.targetLang, e.source, e.target, e.category, e.note ?? ""]);
    const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glossary-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("CSV must have a header row + at least one data row.");
        return;
      }
      // Simple CSV parser (handles quoted fields with embedded commas/newlines).
      const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQuotes) {
            if (ch === '"') {
              if (line[i + 1] === '"') { cur += '"'; i++; }
              else inQuotes = false;
            } else cur += ch;
          } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ",") { result.push(cur); cur = ""; }
            else cur += ch;
          }
        }
        result.push(cur);
        return result;
      };
      const headers = parseRow(lines[0]).map((h) => h.trim().toLowerCase());
      const srcIdx = headers.indexOf("source");
      const tgtIdx = headers.indexOf("target");
      const slIdx = headers.indexOf("sourcelang");
      const tlIdx = headers.indexOf("targetlang");
      const catIdx = headers.indexOf("category");
      const noteIdx = headers.indexOf("note");
      if (srcIdx < 0 || tgtIdx < 0) {
        toast.error("CSV must have 'source' and 'target' columns.");
        return;
      }
      let ok = 0;
      let total = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = parseRow(lines[i]);
        const source = cols[srcIdx]?.trim();
        const target = cols[tgtIdx]?.trim();
        if (!source || !target) continue;
        total++;
        const body: Record<string, unknown> = { source, target };
        if (slIdx >= 0) body.sourceLang = cols[slIdx]?.trim() || "en";
        if (tlIdx >= 0) body.targetLang = cols[tlIdx]?.trim() || "hi";
        if (catIdx >= 0) body.category = cols[catIdx]?.trim() || "general";
        if (noteIdx >= 0) body.note = cols[noteIdx]?.trim() || null;
        try {
          const res = await fetch("/api/glossary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (res.ok) ok++;
        } catch {
          // skip duplicates / errors
        }
      }
      toast.success(`Imported ${ok} of ${total} entries from CSV.`);
      void load();
    } catch {
      toast.error("CSV import failed — invalid file.");
    }
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={BookOpen}
        title="Glossary"
        nativeTitle="शब्दकोश"
        subtitle="Curated domain terminology for consistent translations across Marathi, Hindi and English."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowSuggest(true)}>
              <Sparkles className="h-3.5 w-3.5" /> Auto-suggest
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={!entries.length} title="Export as CSV">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportJson} disabled={!entries.length} title="Export as JSON">
              <Download className="h-3.5 w-3.5" /> JSON
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" /> Add term
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search terms, translations or notes…"
              className="pl-9"
            />
          </div>
          <Select value={filterLang} onValueChange={setFilterLang}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Language pair" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All pairs</SelectItem>
              <SelectItem value="en-hi">EN → HI</SelectItem>
              <SelectItem value="en-mr">EN → MR</SelectItem>
              <SelectItem value="hi-en">HI → EN</SelectItem>
              <SelectItem value="hi-mr">HI → MR</SelectItem>
              <SelectItem value="mr-en">MR → EN</SelectItem>
              <SelectItem value="mr-hi">MR → HI</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Entries */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No glossary entries yet"
              description="Add domain-specific terms to keep translations consistent — e.g. pin 'drip irrigation' → 'ठिबक सिंचन'."
              action={
                <div className="flex items-center gap-2">
                  <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
                    <Plus className="h-3.5 w-3.5" /> Add your first term
                  </Button>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/60">
                    <Upload className="h-3.5 w-3.5" /> Import CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void importCsv(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              }
              className="border-0"
            />
          ) : (
            <div className="max-h-[60vh] overflow-y-auto scroll-area-thin">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Source</th>
                    <th className="w-8 px-2 py-2.5" />
                    <th className="px-4 py-2.5 font-medium">Translation</th>
                    <th className="px-4 py-2.5 font-medium">Category</th>
                    <th className="w-20 px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium" lang={entry.sourceLang}>{entry.source}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {languageLabel(entry.sourceLang)} → {languageLabel(entry.targetLang)}
                        </p>
                      </td>
                      <td className="px-2 py-3 align-top text-muted-foreground">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium devanagari" lang={entry.targetLang}>{entry.target}</p>
                        {entry.note && <p className="text-[11px] text-muted-foreground italic">{entry.note}</p>}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge className={`text-[11px] ${CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.general}`} variant="secondary">
                          {entry.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(entry)} aria-label="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(entry.id)} aria-label="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import / count footer */}
      {!loading && entries.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{entries.length} entr{entries.length === 1 ? "y" : "ies"}</span>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 hover:bg-muted/60">
              <Upload className="h-3.5 w-3.5" /> Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importCsv(f);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 hover:bg-muted/60">
              <Upload className="h-3.5 w-3.5" /> Import JSON
              <input
                type="file"
                accept="application/json"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importJson(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Add dialog */}
      {(showAdd || editing) && (
        <GlossaryDialog
          entry={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { setShowAdd(false); setEditing(null); void load(); }}
        />
      )}

      {/* Auto-suggest dialog */}
      {showSuggest && (
        <SuggestDialog
          onClose={() => setShowSuggest(false)}
          onAdded={() => { setShowSuggest(false); void load(); }}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- Dialog

interface GlossaryDialogProps {
  entry: GlossaryEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

const GlossaryDialog = ({ entry, onClose, onSaved }: GlossaryDialogProps) => {
  const [sourceLang, setSourceLang] = useState(entry?.sourceLang ?? "en");
  const [targetLang, setTargetLang] = useState(entry?.targetLang ?? "hi");
  const [source, setSource] = useState(entry?.source ?? "");
  const [target, setTarget] = useState(entry?.target ?? "");
  const [category, setCategory] = useState(entry?.category ?? "general");
  const [note, setNote] = useState(entry?.note ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!source.trim() || !target.trim()) {
      toast.error("Both source and translation are required.");
      return;
    }
    setSaving(true);
    try {
      const body = { sourceLang, targetLang, source: source.trim(), target: target.trim(), category, note: note.trim() || null };
      const res = entry
        ? await fetch(`/api/glossary/${entry.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/glossary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save.");
      toast.success(entry ? "Entry updated." : "Entry added.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {entry ? "Edit glossary term" : "Add glossary term"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">From language</Label>
              <LanguageSelect variant="target" value={sourceLang} onChange={setSourceLang} className="w-full" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">To language</Label>
              <LanguageSelect variant="target" value={targetLang} onChange={setTargetLang} className="w-full" />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Source term</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. drip irrigation" lang={sourceLang} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Approved translation</Label>
            <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. ठिबक सिंचन" lang={targetLang} className="devanagari" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context or usage note" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="gap-1.5">
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {entry ? "Save changes" : "Add term"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --------------------------------------------------------------------------- Suggest

interface Suggestion {
  source: string;
  target: string;
  frequency: number;
}

const SuggestDialog = ({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) => {
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("hi");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const generate = async () => {
    setLoading(true);
    setLoaded(false);
    try {
      const res = await fetch(`/api/glossary/suggest?sourceLang=${sourceLang}&targetLang=${targetLang}&limit=15`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to generate suggestions");
      setSuggestions(data.suggestions ?? []);
      setSelected(new Set());
      setLoaded(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate suggestions");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (source: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const addSelected = async () => {
    setAdding(true);
    let ok = 0;
    for (const s of suggestions) {
      if (!selected.has(s.source)) continue;
      try {
        const res = await fetch("/api/glossary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceLang, targetLang, source: s.source, target: s.target, category: "general" }),
        });
        if (res.ok) ok++;
      } catch {
        // skip duplicates / errors
      }
    }
    setAdding(false);
    toast.success(`Added ${ok} term${ok === 1 ? "" : "s"} to the glossary.`);
    onAdded();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Auto-suggest glossary terms
          </DialogTitle>
          <DialogDescription>
            Mine your translation history to discover recurring source→target phrase pairs worth pinning as glossary entries.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-3 py-2">
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs text-muted-foreground">From</Label>
            <LanguageSelect variant="target" value={sourceLang} onChange={setSourceLang} className="w-full" />
          </div>
          <ArrowRight className="mb-2 h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs text-muted-foreground">To</Label>
            <LanguageSelect variant="target" value={targetLang} onChange={setTargetLang} className="w-full" />
          </div>
          <Button onClick={generate} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </Button>
        </div>

        <div className="max-h-[360px] overflow-y-auto scroll-area-thin rounded-lg border">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Mining translation history…
            </div>
          )}
          {!loading && loaded && suggestions.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No new suggestions found. Translate more text in this language pair to build a corpus.
            </div>
          )}
          {!loading && suggestions.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2 font-medium">Source phrase</th>
                  <th className="px-3 py-2 font-medium">Translation</th>
                  <th className="w-16 px-3 py-2 text-right font-medium">Freq</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => {
                  const isSelected = selected.has(s.source);
                  return (
                    <tr
                      key={s.source}
                      onClick={() => toggle(s.source)}
                      className={`cursor-pointer border-t transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/40"}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(s.source)}
                          className="h-4 w-4 rounded border-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">{s.source}</td>
                      <td className="px-3 py-2 align-top devanagari" lang={targetLang}>{s.target}</td>
                      <td className="px-3 py-2 text-right align-top">
                        <Badge variant="secondary" className="text-[10px]">×{s.frequency}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && !loaded && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Pick a language pair and click "Generate" to mine suggestions.
            </div>
          )}
        </div>

        <DialogFooter className="items-center">
          <span className="mr-auto text-xs text-muted-foreground">
            {selected.size > 0 ? `${selected.size} selected` : ""}
          </span>
          <Button variant="outline" onClick={onClose} className="gap-1.5">
            <X className="h-4 w-4" /> Close
          </Button>
          <Button onClick={addSelected} disabled={adding || selected.size === 0} className="gap-1.5">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add {selected.size > 0 ? selected.size : ""} to glossary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
