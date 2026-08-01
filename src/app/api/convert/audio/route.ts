import { NextResponse } from "next/server";
import { AudioConverter } from "@/lib/application/AudioConverter";
import { saveUpload } from "@/lib/infrastructure/storage/file-storage";
import { formatBytes, MAX_UPLOAD_BYTES } from "@/lib/domain/media-formats";
import path from "node:path";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json<ApiError>({ error: "Expected multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json<ApiError>({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json<ApiError>(
      { error: `File too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_UPLOAD_BYTES)}.` },
      { status: 413 },
    );
  }
  const targetFormat = String(form.get("format") ?? "mp3").toLowerCase();
  const bitrate = form.get("bitrate") ? String(form.get("bitrate")) : undefined;
  const sampleRate = form.get("sampleRate") ? Number(form.get("sampleRate")) : undefined;

  const buffer = Buffer.from(await file.arrayBuffer());
  const storedPath = await saveUpload(`conv-${Date.now()}`, file.name, buffer);

  try {
    const result = await AudioConverter.run({
      inputPath: storedPath,
      inputName: file.name,
      targetFormat,
      bitrate,
      sampleRate,
    });
    return NextResponse.json({
      jobId: result.jobId,
      outputPath: result.outputPath,
      downloadName: path.basename(result.outputPath),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audio conversion failed.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
