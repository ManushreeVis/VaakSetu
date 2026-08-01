"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar-nav";
import { useAppStore } from "./app-store";
import { DashboardView } from "./views/dashboard-view";
import { TextTranslateView } from "./views/text-translate-view";
import { MediaTranslateView } from "./views/media-translate-view";
import { DocumentChatView } from "./views/document-chat-view";
import { SummaryView } from "./views/summary-view";
import { ConvertView } from "./views/convert-view";
import { HistoryView } from "./views/history-view";
import { ModelsView } from "./views/models-view";
import { FinetuneView } from "./views/finetune-view";
import { SettingsView } from "./views/settings-view";

const VIEW_TITLES: Record<string, { title: string; native: string }> = {
  dashboard: { title: "Dashboard", native: "डॅशबोर्ड" },
  text: { title: "Text Translation", native: "मजकूर भाषांतर" },
  media: { title: "Audio & Video Translation", native: "ध्वनी व व्हिडिओ भाषांतर" },
  chat: { title: "Chat with your Document", native: "दस्तऐवजाशी संभाषण" },
  summary: { title: "Summarize", native: "सारांश" },
  convert: { title: "Format Conversion", native: "स्वरूप रूपांतर" },
  history: { title: "History", native: "इतिहास" },
  models: { title: "Models & Auto-Select", native: "प्रारूपे व स्वयंचलित निवड" },
  finetune: { title: "Fine-tune Models", native: "प्रारूप फाइन-ट्यूनिंग" },
  settings: { title: "Settings", native: "सेटिंग्ज" },
};

export function AppShell() {
  const { activeView, setSidebarOpen } = useAppStore();
  const meta = VIEW_TITLES[activeView] ?? VIEW_TITLES.dashboard;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1">
        <SidebarNav />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top header (mobile menu + breadcrumb) */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{meta.title}</p>
              <p className="truncate text-[11px] text-muted-foreground devanagari">{meta.native}</p>
            </div>
            <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                IndicTrans2 ready
              </span>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 px-4 py-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">
              {activeView === "dashboard" && <DashboardView />}
              {activeView === "text" && <TextTranslateView />}
              {activeView === "media" && <MediaTranslateView />}
              {activeView === "chat" && <DocumentChatView />}
              {activeView === "summary" && <SummaryView />}
              {activeView === "convert" && <ConvertView />}
              {activeView === "history" && <HistoryView />}
              {activeView === "models" && <ModelsView />}
              {activeView === "finetune" && <FinetuneView />}
              {activeView === "settings" && <SettingsView />}
            </div>
          </main>

          {/* Sticky footer */}
          <footer className="mt-auto border-t bg-background/80 px-4 py-4 backdrop-blur lg:px-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
              <p>
                <span className="font-medium text-foreground">BhashaSetu</span> · भाषासेतु —
                Offline multilingual translation suite for BAIF · Built with open-source models
                (IndicTrans2 · Whisper · AI4Bharat TTS).
              </p>
              <p className="flex items-center gap-3">
                <span>Tech for Good Hackathon</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">No data leaves your premises</span>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
