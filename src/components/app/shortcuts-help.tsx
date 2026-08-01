"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface ShortcutRow {
  keys: string;
  action: string;
}

const ROWS: ShortcutRow[] = [
  { keys: "⌘ K", action: "Open command palette" },
  { keys: "?", action: "Toggle this shortcuts help" },
  { keys: "n", action: "New chat session (in Chat view)" },
  { keys: "g  d", action: "Go to Dashboard" },
  { keys: "g  t", action: "Go to Text Translation" },
  { keys: "g  b", action: "Go to Batch Translation" },
  { keys: "g  m", action: "Go to Audio / Video Translation" },
  { keys: "g  c", action: "Go to Chat with Document" },
  { keys: "g  s", action: "Go to Summarize" },
  { keys: "g  f", action: "Go to Format Conversion" },
  { keys: "g  g", action: "Go to Glossary" },
  { keys: "g  h", action: "Go to History" },
  { keys: "g  o", action: "Go to Models" },
  { keys: "g  n", action: "Go to Fine-tune" },
  { keys: "g  ,", action: "Go to Settings" },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onToggle = () => setOpen((o) => !o);
    window.addEventListener("bhasha:toggle-shortcuts", onToggle);
    return () => window.removeEventListener("bhasha:toggle-shortcuts", onToggle);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" /> Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Power-user navigation for BhashaSetu. Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">?</kbd> anytime to reopen this.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          {ROWS.map((r) => (
            <div
              key={r.keys}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/60"
            >
              <span className="text-sm">{r.action}</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {r.keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="pt-1 text-xs text-muted-foreground">
          Shortcuts are disabled while typing in input fields.
        </p>
      </DialogContent>
    </Dialog>
  );
}
