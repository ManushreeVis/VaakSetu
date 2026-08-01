/**
 * BhashaSetu — Electron preload.
 * Exposes a minimal, safe bridge to the renderer (currently read-only app metadata).
 */
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("bhashaSetu", {
  isDesktop: true,
  version: process.env.npm_package_version ?? "1.0.0",
  platform: process.platform,
});
