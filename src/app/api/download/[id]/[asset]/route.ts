import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { fileExists } from "@/lib/infrastructure/storage/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  srt: "application/x-subrip",
  vtt: "text/vtt",
  txt: "text/plain",
  json: "application/json",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  ogg: "audio/ogg",
  opus: "audio/ogg",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; asset: string }> }) {
  const { id, asset } = await params;

  // Prevent path traversal: asset must be a bare filename.
  if (asset.includes("/") || asset.includes("..") || asset.includes("\\")) {
    return NextResponse.json({ error: "Invalid asset." }, { status: 400 });
  }

  const ext = path.extname(asset).slice(1).toLowerCase();
  const isMedia = ["wav", "mp3", "m4a", "aac", "flac", "ogg", "opus", "mp4", "webm"].includes(ext);
  const disposition = isMedia ? "inline" : `attachment; filename="${asset}"`;
  const mimeType = MIME[ext] ?? (isMedia ? "audio/mpeg" : "application/octet-stream");

  let filePath = path.join(process.cwd(), "storage", "outputs", id, asset);
  if (!(await fileExists(filePath))) {
    // Also check chat output dir
    const alt = path.join(process.cwd(), "storage", "outputs", `chat-${id}`, asset);
    if (await fileExists(alt)) {
      filePath = alt;
    } else {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
  }

  const buf = await fs.readFile(filePath);

  // Inspect binary magic bytes to guarantee accurate Content-Type (MP3 vs WAV)
  let finalMime = mimeType;
  if (isMedia && buf.length >= 4) {
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
      finalMime = "audio/wav";
    } else if (
      (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
      (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
    ) {
      finalMime = "audio/mpeg";
    }
  }

  return new NextResponse(buf, {
    headers: {
      "Content-Type": finalMime,
      "Content-Disposition": disposition,
      "Accept-Ranges": "bytes",
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
