# BhashaSetu — Desktop (`.exe`) Build Guide

BhashaSetu ships as a **standalone Windows desktop application** (also macOS/Linux) via
**Electron + electron-builder**. The installer bundles the Next.js standalone server, the UI,
and the open-source model weights — so a field officer can run it on a laptop with **no internet
and no Node.js installed**.

## 1. Prerequisites (build machine only — needs internet once)

- Node.js 20 LTS **or** Bun ≥ 1.1
- The BhashaSetu source repo
- (Windows builds from any OS; macOS builds require macOS)

## 2. Install build dependencies

```bash
cd bhashasetu
bun install
bun add -D electron electron-builder tsx
```

## 3. Compile the Electron main/preload (TypeScript → JS)

```bash
bunx tsc electron/main.ts electron/preload.ts \
  --module commonjs --target es2020 --esModuleInterop \
  --outDir electron/dist --skipLibCheck
```

(Or add to `package.json`: `"electron:build": "tsc electron/main.ts electron/preload.ts --module commonjs --target es2020 --esModuleInterop --outDir electron/dist --skipLibCheck"`.)

## 4. Build the Next.js standalone bundle

```bash
bun run build
```

This produces `.next/standalone/` (a self-contained Node server) + `.next/static/`.

## 5. Produce the installer

```bash
bunx electron-builder --config electron-builder.yml
```

Output (in `release/`):

- `BhashaSetu-1.0.0-x64.exe` — **NSIS installer** (per-machine, desktop + Start-menu shortcuts)
- `BhashaSetu-1.0.0-x64.exe` (portable) — single-file portable build

## 6. Package scripts (add to `package.json`)

```jsonc
{
  "main": "electron/dist/main.js",
  "scripts": {
    "electron:build": "tsc electron/main.ts electron/preload.ts --module commonjs --target es2020 --esModuleInterop --outDir electron/dist --skipLibCheck",
    "electron:dev": "bunx electron electron/dist/main.js",
    "dist": "bun run build && bun run electron:build && bunx electron-builder --config electron-builder.yml"
  }
}
```

Run `bun run dist` for the one-shot Windows build.

## 7. What the installer contains

| Component | Source | License |
|---|---|---|
| BhashaSetu UI + server | `.next/standalone` | MIT (project) |
| IndicTrans2 weights | `models/indictrans2` | MIT (AI4Bharat) |
| Whisper weights | `models/whisper-*.pt` | MIT (OpenAI) |
| AI4Bharat TTS | `models/indic-tts` | MIT (AI4Bharat) |
| ffmpeg | bundled or system | LGPL/ GPL depending on build |
| SQLite DB | `userData/bhashasetu.db` | public domain |

Total installer size ≈ 1.5–3 GB (dominated by model weights). For lighter field laptops, ship
Whisper-**small** only and skip the LLM.

## 8. First run on a target machine

1. Double-click `BhashaSetu-Setup-1.0.0.exe`.
2. Choose install directory (default `C:\Program Files\BhashaSetu`).
3. Launch from desktop shortcut. The Electron window opens, the bundled server starts on
   `127.0.0.1`, and the dashboard loads — **no internet required**.
4. Translations, transcriptions and generated files are stored under
   `%APPDATA%\BhashaSetu\storage\` and `%APPDATA%\BhashaSetu\bhashasetu.db`.

## 9. Updating models without rebuilding

Drop new/updated weights into `%PROGRAMDATA%\BhashaSetu\models\` (or the `extraResources`
location) and restart the app — no reinstall needed.

## 10. Code-signing (optional, for enterprise rollout)

For silent enterprise deployment, sign the installer with BAIF's code-signing certificate:

```bash
bunx electron-builder --config electron-builder.yml \
  --win.certificateFile=baif.pfx --win.certificatePassword=*****
```

Unsigned installers still run but trigger a SmartScreen prompt.
