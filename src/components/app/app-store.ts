"use client";

import { create } from "zustand";

export type ViewId =
  | "dashboard"
  | "text"
  | "batch"
  | "media"
  | "chat"
  | "summary"
  | "convert"
  | "glossary"
  | "history"
  | "models"
  | "finetune"
  | "settings";

interface AppState {
  activeView: ViewId;
  setView: (view: ViewId) => void;
  /** Default source language used across tools. */
  defaultSourceLang: string;
  defaultTargetLang: string;
  setDefaultSourceLang: (lang: string) => void;
  setDefaultTargetLang: (lang: string) => void;
  /** Whether model auto-select is enabled (vs manual). */
  autoModel: boolean;
  setAutoModel: (v: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: "dashboard",
  setView: (activeView) => set({ activeView, sidebarOpen: false }),
  defaultSourceLang: "auto",
  defaultTargetLang: "hi",
  setDefaultSourceLang: (defaultSourceLang) => set({ defaultSourceLang }),
  setDefaultTargetLang: (defaultTargetLang) => set({ defaultTargetLang }),
  autoModel: true,
  setAutoModel: (autoModel) => set({ autoModel }),
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
