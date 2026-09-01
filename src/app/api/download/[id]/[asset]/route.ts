import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { createReadStream, statSync } from "fs";
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
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string; asset: string }> }) {
  const { id, asset } = await params;

  // Prevent path traversal: asset must be a bare filename.
  if (asset.includes("/") || asset.includes("..") || asset.includes("\\")) {
    return NextResponse.json({ error: "Invalid asset." }, { status: 400 });
  }

  const ext = path.extname(asset).slice(1).toLowerCase();
  const isVideo = ["mp4", "webm", "mov", "mkv"].includes(ext);
  const isAudio = ["wav", "mp3", "m4a", "aac", "flac", "ogg", "opus"].includes(ext);
  const isMedia = isVideo || isAudio;
  const disposition = isMedia ? "inline" : `attachment; filename="${asset}"`;
  const mimeType = MIME[ext] ?? (isVideo ? "video/mp4" : isAudio ? "audio/mpeg" : "application/octet-stream");

  // Check possible storage locations
  let filePath = path.join(process.cwd(), "storage", "outputs", id, asset);
  if (!(await fileExists(filePath))) {
    const uploadPath = path.join(process.cwd(), "storage", "uploads", id, asset);
    const chatPath = path.join(process.cwd(), "storage", "outputs", `chat-${id}`, asset);
    if (await fileExists(uploadPath)) {
      filePath = uploadPath;
    } else if (await fileExists(chatPath)) {
      filePath = chatPath;
    } else {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const range = request.headers.get("range");

  // Support HTTP Range Requests for video/audio seeking
  if (range && isMedia) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    const fileHandle = await fs.open(filePath, "r");
    const buffer = Buffer.alloc(chunksize);
    await fileHandle.read(buffer, 0, chunksize, start);
    await fileHandle.close();

    return new NextResponse(buffer, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunksize),
        "Content-Type": mimeType,
        "Content-Disposition": disposition,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const buf = await fs.readFile(filePath);

  let finalMime = mimeType;
  if (isAudio && buf.length >= 4) {
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
      "Content-Length": String(fileSize),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
