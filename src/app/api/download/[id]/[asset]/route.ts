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
  const filePath = path.join(process.cwd(), "storage", "outputs", id, asset);
  if (!(await fileExists(filePath))) {
    // Also check chat output dir.
    const alt = path.join(process.cwd(), "storage", "outputs", `chat-${id}`, asset);
    if (await fileExists(alt)) {
      const buf = await fs.readFile(alt);
      const ext = path.extname(asset).slice(1).toLowerCase();
      return new NextResponse(buf, {
        headers: {
          "Content-Type": MIME[ext] ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${asset}"`,
        },
      });
    }
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const buf = await fs.readFile(filePath);
  const ext = path.extname(asset).slice(1).toLowerCase();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asset}"`,
    },
  });
}
