"use client";

import { useEffect, useState } from "react";
import { SpotlightTour } from "./spotlight-tour";

const STORAGE_KEY = "bhashasetu:onboarded";

const STEPS = [
  {
    title: "स्वागत! Welcome to BhashaSetu",
    body: "भाषासेतु — an offline-capable translation suite for BAIF. Transcribe, translate and voice Marathi, Hindi & English from text, audio and video. Let's take a quick tour.",
    selector: '[data-tour="brand"]',
  },
  {
    title: "Translate anything",
    body: "Translate plain text between Marathi, Hindi and English using IndicTrans2. Click 'Text Translate' to start, or use the command palette (⌘K).",
    selector: '[data-tour="nav-text"]',
  },
  {
    title: "Audio & Video translation",
    body: "Upload a video or audio file — BhashaSetu transcribes the speech, translates it, and generates subtitles + a translated voice-over. You can even burn captions directly into the video.",
    selector: '[data-tour="nav-media"]',
  },
  {
    title: "Chat with your document",
    body: "Ask questions about any document by text or voice — answers are spoken back in your language. Great for field staff reading extension manuals.",
    selector: '[data-tour="nav-chat"]',
  },
  {
    title: "Domain glossary",
    body: "Pin specific translations for technical terms (e.g. 'drip irrigation' → 'ठिबक सिंचन') so every translation stays consistent. The glossary is auto-applied to your translations.",
    selector: '[data-tour="nav-glossary"]',
  },
  {
    title: "Quick search anything",
    body: "Press ⌘K (or Ctrl+K) anytime to jump between views, find recent jobs, or trigger actions. Use vim-style 'g' + a letter to navigate even faster.",
    selector: '[data-tour="palette-btn"]',
  },
  {
    title: "You're all set!",
    body: "Everything runs on-premises with open-source models — no data leaves your network. Explore the dashboard to see your activity, or start translating now.",
    selector: null,
  },
] as const;

export function OnboardingTour() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        // Small delay so the app shell renders first.
        const t = setTimeout(() => setShouldShow(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage may be unavailable (private mode); skip tour.
    }
  }, []);

  const dismiss = () => {
    setShouldShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  const restart = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setShouldShow(true);
  };

  return (
    <>
      {shouldShow && <SpotlightTour steps={STEPS as unknown as SpotlightStep[]} onClose={dismiss} />}
      {/* Expose a global restart hook for the settings page / command palette. */}
      <RestartHook onRestart={restart} />
    </>
  );
}

interface SpotlightStep {
  title: string;
  body: string;
  selector: string | null;
}

/** Invisible component that listens for a custom event to restart the tour. */
const RestartHook = ({ onRestart }: { onRestart: () => void }) => {
  useEffect(() => {
    const handler = () => onRestart();
    window.addEventListener("bhasha:restart-tour", handler);
    return () => window.removeEventListener("bhasha:restart-tour", handler);
  }, [onRestart]);
  return null;
};
