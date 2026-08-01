"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Languages,
  Layers,
  Clapperboard,
  MessagesSquare,
  ScrollText,
  Repeat2,
  BookOpen,
  History,
  Cpu,
  Wand2,
  Settings,
  Search,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { useAppStore, type ViewId } from "./app-store";
import { languageLabel } from "@/lib/domain/languages";

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  shortcut?: string;
  group: "Navigate" | "Actions";
  run: () => void;
}

interface RecentJob {
  id: string;
  kind: string;
  status: string;
  sourceLang: string;
  targetLang: string;
  inputName: string | null;
  inputText: string | null;
  createdAt: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { setView, setSidebarOpen } = useAppStore();
  const [recent, setRecent] = useState<RecentJob[]>([]);

  // Global ⌘K / Ctrl+K listener + custom toggle event (for header button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onToggle = () => setOpen((o) => !o);
    window.addEventListener("keydown", onKey);
    window.addEventListener("bhasha:toggle-palette", onToggle);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("bhasha:toggle-palette", onToggle);
    };
  }, []);

  // Load recent jobs whenever the palette opens (cheap fetch).
  useEffect(() => {
    if (!open) return;
    void fetch("/api/jobs?limit=6")
      .then((r) => r.json())
      .then((d: { jobs: RecentJob[] }) => setRecent(d.jobs ?? []))
      .catch(() => setRecent([]));
  }, [open]);

  const go = useCallback(
    (view: ViewId) => {
      setView(view);
      setOpen(false);
    },
    [setView],
  );

  const navItems = useMemo<PaletteItem[]>(
    () => [
      { id: "nav-dash", label: "Dashboard", hint: "डॅशबोर्ड", icon: LayoutDashboard, shortcut: "g d", group: "Navigate", run: () => go("dashboard") },
      { id: "nav-text", label: "Text Translation", hint: "मजकूर भाषांतर", icon: Languages, shortcut: "g t", group: "Navigate", run: () => go("text") },
      { id: "nav-batch", label: "Batch Translation", hint: "साखळी भाषांतर", icon: Layers, shortcut: "g b", group: "Navigate", run: () => go("batch") },
      { id: "nav-media", label: "Audio & Video Translation", hint: "ध्वनी / व्हिडिओ", icon: Clapperboard, shortcut: "g m", group: "Navigate", run: () => go("media") },
      { id: "nav-chat", label: "Chat with Document", hint: "दस्तऐवजाशी संभाषण", icon: MessagesSquare, shortcut: "g c", group: "Navigate", run: () => go("chat") },
      { id: "nav-summary", label: "Summarize", hint: "सारांश", icon: ScrollText, shortcut: "g s", group: "Navigate", run: () => go("summary") },
      { id: "nav-convert", label: "Format Conversion", hint: "स्वरूप रूपांतर", icon: Repeat2, shortcut: "g f", group: "Navigate", run: () => go("convert") },
      { id: "nav-glossary", label: "Glossary", hint: "शब्दकोश", icon: BookOpen, shortcut: "g g", group: "Navigate", run: () => go("glossary") },
      { id: "nav-history", label: "History", hint: "इतिहास", icon: History, shortcut: "g h", group: "Navigate", run: () => go("history") },
      { id: "nav-models", label: "Models & Auto-Select", hint: "प्रारूपे", icon: Cpu, shortcut: "g o", group: "Navigate", run: () => go("models") },
      { id: "nav-finetune", label: "Fine-tune Models", hint: "फाइन-ट्यून", icon: Wand2, shortcut: "g n", group: "Navigate", run: () => go("finetune") },
      { id: "nav-settings", label: "Settings", hint: "सेटिंग्ज", icon: Settings, shortcut: "g ,", group: "Navigate", run: () => go("settings") },
    ],
    [go],
  );

  const actionItems = useMemo<PaletteItem[]>(
    () => [
      { id: "act-open-sidebar", label: "Open navigation menu (mobile)", icon: Search, group: "Actions", run: () => { setSidebarOpen(true); setOpen(false); } },
    ],
    [setSidebarOpen],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="BhashaSetu command palette"
      description="Search views, recent jobs and quick actions. Press ⌘K to toggle."
      className="max-w-xl"
    >
      <CommandInput placeholder="Type a view name, action, or search recent jobs…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.hint ?? ""}`}
                onSelect={() => item.run()}
              >
                <Icon className="h-4 w-4 text-primary" />
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="text-xs text-muted-foreground devanagari">{item.hint}</span>}
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {actionItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.id} value={item.label} onSelect={() => item.run()}>
                <Icon className="h-4 w-4 text-primary" />
                <span className="flex-1">{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {recent.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent jobs">
              {recent.map((job) => {
                const preview = (job.inputName ?? job.inputText ?? "Untitled").slice(0, 60);
                return (
                  <CommandItem
                    key={job.id}
                    value={`${preview} ${job.kind} ${job.sourceLang} ${job.targetLang}`}
                    onSelect={() => {
                      go("history");
                      // Allow the history view to optionally react.
                      window.dispatchEvent(new CustomEvent("bhasha:focus-job", { detail: job.id }));
                    }}
                  >
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{preview}</span>
                    <span className="text-xs text-muted-foreground">
                      {languageLabel(job.sourceLang)} → {languageLabel(job.targetLang)}
                    </span>
                    <CornerDownLeft className="ml-2 h-3 w-3 text-muted-foreground" />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
