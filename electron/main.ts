/**
 * BhashaSetu — Electron main process.
 *
 * Packages the Next.js standalone server into a desktop application (.exe on Windows).
 * On launch it starts the bundled Node server on a free localhost port and opens a
 * BrowserWindow pointing at it. All AI models run on-prem (IndicTrans2 / Whisper /
 * AI4Bharat TTS) so no outbound network is required.
 *
 * Build: see docs/BUILD.md  (`bun run dist` produces the Windows installer).
 */
import { app, BrowserWindow, shell } from "electron";
import path from "node:path";
import { spawn } from "node:child_process";

const isDev = !app.isPackaged;

const startServer = (): Promise<number> =>
  new Promise((resolve, reject) => {
    if (isDev) {
      // In dev, the Next.js dev server is already running on 3000.
      resolve(3000);
      return;
    }
    // In production, run the bundled standalone server.
    const serverFile = path.join(process.resourcesPath, "app", ".next", "standalone", "server.js");
    const env = { ...process.env, PORT: "0", HOSTNAME: "127.0.0.1" };
    const child = spawn(process.execPath, [serverFile], { env, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout?.on("data", (chunk: Buffer) => {
      const match = chunk.toString().match(/ready on http:\/\/[^\d]+(\d+)/);
      if (match) resolve(parseInt(match[1], 10));
    });
    child.on("error", reject);
    child.stderr?.on("data", (chunk: Buffer) => console.error("[server]", chunk.toString()));
  });

const createWindow = async () => {
  const port = await startServer();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0f1a16",
    title: "BhashaSetu",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  await win.loadURL(`http://127.0.0.1:${port}/`);
};

app.whenReady().then(() => {
  void createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
