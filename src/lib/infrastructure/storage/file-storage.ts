/**
 * Local file storage for uploads + generated outputs.
 * On-prem deployments can swap this for a network file-server mount.
 */

import fs from "fs/promises";
import path from "path";

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const UPLOADS_DIR = path.join(STORAGE_ROOT, "uploads");
const OUTPUTS_DIR = path.join(STORAGE_ROOT, "outputs");

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

export const saveUpload = async (
  jobId: string,
  originalName: string,
  data: Buffer,
): Promise<string> => {
  const dir = path.join(UPLOADS_DIR, jobId);
  await ensureDir(dir);
  const safe = originalName.replace(/[^\w.\-]+/g, "_");
  const filePath = path.join(dir, safe);
  await fs.writeFile(filePath, data);
  return filePath;
};

export const saveOutput = async (
  jobId: string,
  name: string,
  data: Buffer | string,
): Promise<string> => {
  const dir = path.join(OUTPUTS_DIR, jobId);
  await ensureDir(dir);
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, data);
  return filePath;
};

export const readOutput = async (filePath: string): Promise<Buffer> => {
  return fs.readFile(filePath);
};

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const safeBasename = (filePath: string): string => path.basename(filePath);

/** Derive a download file name for an output path. */
export const downloadName = (filePath: string): string => path.basename(filePath);

export const STORAGE_PATHS = { STORAGE_ROOT, UPLOADS_DIR, OUTPUTS_DIR };
