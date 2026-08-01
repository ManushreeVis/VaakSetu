# BhashaSetu — On-Premises Deployment Guide

BhashaSetu runs **entirely on BAIF's on-premises infrastructure** (file server and/or standalone
machines). No data leaves the network; no external services are used; all models are open-source
(MIT) with no licensing or usage cost. It is developed and deployed **outside HSBC** with no
dependency on HSBC systems.

## 1. Hardware requirements (recommended)

| Use case | CPU | RAM | GPU | Disk |
|---|---|---|---|---|
| Field laptop (text + short media) | 4-core | 8 GB | optional (CPU Whisper-small OK) | 20 GB |
| Office workstation (media + fine-tune) | 8-core | 32 GB | NVIDIA 8 GB VRAM (e.g. T4/RTX 3060) | 100 GB |
| File-server (shared, multi-user) | 8-core | 32 GB | NVIDIA 16 GB VRAM | 500 GB SSD |

CPU-only operation is supported (Whisper-small + IndicTrans2 CPU). GPU accelerates media + fine-tune.

## 2. Software prerequisites

- **Node.js 20 LTS** (or Bun ≥ 1.1)
- **ffmpeg 5+** (apt: `ffmpeg`; win: bundle the static binary)
- **Python 3.10** (only for model serving / fine-tuning — see below)
- **CUDA 12.x** (GPU machines)
- **SQLite** (bundled — no separate DB server needed; swap to PostgreSQL for >50 concurrent users)

## 3. Install the application

```bash
# On the on-prem machine (no internet needed after initial model download)
git clone <internal-clone-url> bhashasetu && cd bhashasetu
bun install            # or npm ci
cp .env.example .env   # set DATABASE_URL, MODEL_CACHE_DIR, etc.
bun run db:push        # create the SQLite schema
```

## 4. Download open-source models (one-time, can be done on an internet-connected machine then transferred)

```bash
# IndicTrans2 (AI4Bharat) — translation
python -m indictrans2.download --model indictrans2-en-indic --out models/indictrans2
python -m indictrans2.download --model indictrans2-indic-en --out models/indictrans2
python -m indictrans2.download --model indictrans2-indic-indic --out models/indictrans2

# Whisper (OpenAI, MIT) — transcription
# small = fast/CPU-friendly, medium = higher accuracy
python -c "import whisper; whisper.load_model('small').model.save('models/whisper-small.pt')"

# AI4Bharat TTS — voice synthesis
git clone https://github.com/AI4Bharat/Indic-TTS models/indic-tts
```

Transfer the `models/` directory to the on-prem machine (USB / internal file server).

## 5. Switch to the on-prem adapter

Implement `src/lib/infrastructure/ai/onprem-adapter.ts` against the four engine contracts in
`engine-contract.ts`. Reference snippets:

```ts
// TranslationEngine — wraps IndicTrans2 (fairseq) via a local Python subprocess or ONNX runtime
const OnpremTranslationEngine: TranslationEngine = {
  async translate({ text, sourceLang, targetLang }) {
    // call IndicTrans2 inference server / CLI; return { text, model: "indictrans2", ... }
  },
};

// TranscriptionEngine — wraps Whisper
const OnpremTranscriptionEngine: TranscriptionEngine = {
  async transcribe(audioPath, language) {
    // whisper.transcribe(audioPath, language) → { text, segments:[{start,end,text}] }
  },
};

// TtsEngine — wraps AI4Bharat TTS
const OnpremTtsEngine: TtsEngine = {
  async synthesize(text, language) {
    // indic-tts.synthesize(text, language) → WAV buffer
  },
};

// LlmEngine — wraps an open-source LLM (IndicLLM / Qwen) for summary + chat
const OnpremLlmEngine: LlmEngine = { /* ... */ };

export const aiEngines: AiEngines = {
  translation: OnpremTranslationEngine,
  transcription: OnpremTranscriptionEngine,
  tts: OnpremTtsEngine,
  llm: OnpremLlmEngine,
};
```

Then point the app at it by changing one import in `src/lib/infrastructure/ai/index.ts`
(or set `AI_ADAPTER=onprem` and select at runtime). **No application/domain code changes.**

## 6. Run as a service

```bash
# Build & start (production)
bun run build
bun run start            # listens on 127.0.0.1:3000

# Or run the desktop build (see BUILD.md) for standalone machines
bun run dist             # → release/BhashaSetu-Setup-1.0.0.exe
```

For multi-user shared deployments, front it with **Caddy/nginx** on the file server and serve over
the intranet. SQLite is fine up to ~50 concurrent users; switch `DATABASE_URL` to PostgreSQL above that.

## 7. Data residency

- Uploads → `storage/uploads/`  · Outputs → `storage/outputs/`  · DB → `db/custom.db`
- All paths are local. Map them to a network share for centralised storage on the file server.
- No telemetry, no analytics, no outbound calls. Verify with `tcpdump` — the app only opens
  `127.0.0.1` sockets.

## 8. Offline verification checklist

- [ ] `bun run build && bun run start` succeeds with network cable unplugged
- [ ] Text/media/summary/chat flows all complete
- [ ] `lsof -i` shows only loopback listeners
- [ ] Models load from `models/` (no HuggingFace Hub calls)
