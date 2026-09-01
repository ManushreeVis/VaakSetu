import { NextResponse } from "next/server";
import { MediaTranslator } from "@/lib/application/MediaTranslator";
import { saveUpload } from "@/lib/infrastructure/storage/file-storage";
import { getFormatByExt, MAX_UPLOAD_BYTES, formatBytes } from "@/lib/domain/media-formats";
import path from "path";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900; // 15 minutes for long video translations


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

  const ext = path.extname(file.name).slice(1).toLowerCase();
  const fmt = getFormatByExt(ext);
  if (!fmt) {
    return NextResponse.json<ApiError>(
      { error: `Unsupported format ".${ext}".` },
      { status: 415 },
    );
  }

  const sourceLang = String(form.get("sourceLang") ?? "auto");
  const targetLang = String(form.get("targetLang") ?? "en");
  const modelId = form.get("modelId") ? String(form.get("modelId")) : undefined;
  const generateVoice = form.get("voice") !== "false";
  const generateSubtitles = form.get("subtitles") !== "false";

  if (!["mr", "hi", "en", "auto"].includes(sourceLang)) {
    return NextResponse.json<ApiError>({ error: "Invalid source language." }, { status: 400 });
  }
  if (!["mr", "hi", "en"].includes(targetLang)) {
    return NextResponse.json<ApiError>({ error: "Invalid target language." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storedPath = await saveUpload(`media-${Date.now()}`, file.name, buffer);

  try {
    const result = await MediaTranslator.run({
      inputPath: storedPath,
      inputName: file.name,
      inputMime: file.type || fmt.mime,
      sourceLang,
      targetLang,
      modelId,
      generateVoice,
      generateSubtitles,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Media translation failed.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
