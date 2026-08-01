# BhashaSetu — Architecture

> भाषासेतु · Offline multilingual translation suite for BAIF · Tech for Good Hackathon

BhashaSetu accepts **text, audio and video** inputs, transcribes any speech, translates between
**Marathi, Hindi and English**, and produces **translated text, translated voice (TTS) and video
subtitles (SRT/VTT)** — entirely on-premises with open-source models.

## Clean Architecture + DDD

The codebase follows Clean Architecture with strict dependency direction
(presentation → application → domain ← infrastructure). The domain layer has no framework
dependencies; the application layer defines use-cases against **engine contracts (ports)**; the
infrastructure layer provides the **adapter** implementations.

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation (src/app, src/components/app)                  │
│  Next.js routes + React views (shadcn/ui, Tailwind 4)        │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTP / fetch
┌───────────────▼─────────────────────────────────────────────┐
│  Application (src/lib/application)                           │
│  ModelSelector · TextTranslator · MediaTranslator ·          │
│  DocumentChatService · Summarizer · SubtitleConverter ·      │
│  AudioConverter · FineTuneService                            │
└───────────────┬─────────────────────────────────────────────┘
                │ depends on contracts only
┌───────────────▼─────────────────────────────────────────────┐
│  Domain (src/lib/domain)                                     │
│  languages · media-formats · models · types  (pure, no I/O)  │
└───────────────▲─────────────────────────────────────────────┘
                │ implemented by
┌───────────────┴─────────────────────────────────────────────┐
│  Infrastructure (src/lib/infrastructure)                     │
│  ai/engine-contract.ts  ← ports                              │
│  ai/zai-adapter.ts      ← demo adapter (z-ai-web-dev-sdk)    │
│  ai/onprem-adapter.ts   ← PRODUCTION (IndicTrans2/Whisper/TTS)│
│  repositories/*          ← Prisma (SQLite)                   │
│  storage/file-storage.ts ← local / network file store        │
└─────────────────────────────────────────────────────────────┘
```

## Engine contracts (ports)

`src/lib/infrastructure/ai/engine-contract.ts` defines four interfaces:
`TranslationEngine`, `TranscriptionEngine`, `TtsEngine`, `LlmEngine`, aggregated as `AiEngines`.

The **application layer depends only on these interfaces** — never on a concrete SDK.

## Demo vs production adapters

| | Demo (this sandbox) | Production (on-prem) |
|---|---|---|
| Translation | z-ai-web-dev-sdk LLM prompted as IndicTrans2 | **IndicTrans2** (AI4Bharat, fairseq) |
| Transcription | z-ai-web-dev-sdk ASR | **Whisper** (OpenAI, MIT) |
| TTS | z-ai-web-dev-sdk TTS | **AI4Bharat TTS / IndicTTS** |
| Summary / Chat / QA | z-ai-web-dev-sdk LLM | Open-source LLM (IndicLLM / Qwen) |
| Media extract / burn | ffmpeg | ffmpeg |
| DB | SQLite (Prisma) | SQLite or PostgreSQL (Prisma) |

Switching to production = implement `onprem-adapter.ts` against the same contracts. **No code
above the adapter layer changes** — this is the core architectural guarantee.

## Open-source, on-prem, zero-cost

Every production model is **open-source (MIT)** and runs locally on BAIF infrastructure — no
licensing fees, no data egress, no dependency on HSBC or any external service. See
`DEPLOYMENT.md`.

## Requirements coverage

| # | Requirement | Where |
|---|---|---|
| 1 | Model auto-select | `application/ModelSelector.ts` + Models view |
| 2 | History | Prisma `Job` + History view (search/filter/download/delete) |
| 3 | Exe build | `electron/` + `electron-builder.yml` + `BUILD.md` |
| 4 | Best UI w/ upload-download | drag-drop multi-format upload, multi-output download |
| 5 | Chat / voice with document | `DocumentChatService` + chat view (ASR in, TTS out) |
| 6 | Summary | `Summarizer` + Summary view |
| 7 | Format conversion | `SubtitleConverter` + `AudioConverter` + Convert view |
| 8 | Fine-tune model | `FineTuneService` + Finetune view + `FINE_TUNE.md` |

## Media pipeline

```
upload → ffprobe (duration/streams) → ffmpeg (extract 16kHz mono WAV)
       → ASR (transcript + segments) → IndicTrans2 (per-segment + whole translation)
       → build SRT/VTT from translated segments
       → TTS synthesize translated text → save WAV
       → persist Job + artifacts → return
```

Optional burned-in captions and audio transcoding are available via `ffmpeg` (`burnSubtitlesIntoVideo`,
`convertAudio` in `utils/ffmpeg.ts`).
