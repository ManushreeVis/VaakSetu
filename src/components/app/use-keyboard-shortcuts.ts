"use client";

import { useEffect } from "react";
import { useAppStore, type ViewId } from "./app-store";

interface ShortcutMapping {
  [key: string]: ViewId;
}

const GOTO: ShortcutMapping = {
  d: "dashboard",
  t: "text",
  b: "batch",
  m: "media",
  c: "chat",
  s: "summary",
  f: "convert",
  g: "glossary",
  h: "history",
  o: "models",
  n: "finetune",
  ",": "settings",
};

/**
 * Vim-style keyboard navigation: press `g` then a letter to jump to a view.
 * Also supports `?` to toggle the shortcuts help (via a CustomEvent so any
 * listener can show help). Ignores keystrokes when the user is typing in an
 * input/textarea/contenteditable or when a modifier (except Shift) is held.
 */
export function useKeyboardShortcuts() {
  const setView = useAppStore((s) => s.setView);

  useEffect(() => {
    let pendingG = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const isTyping = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      const key = e.key.toLowerCase();

      if (key === "?") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("vaak:toggle-shortcuts"));
        return;
      }

      if (key === "g") {
        pendingG = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => {
          pendingG = false;
        }, 800);
        return;
      }

      if (pendingG) {
        const view = GOTO[key];
        if (view) {
          e.preventDefault();
          setView(view);
        }
        pendingG = false;
        if (gTimer) clearTimeout(gTimer);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [setView]);
}
