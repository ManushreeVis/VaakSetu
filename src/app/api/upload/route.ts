import { NextResponse } from "next/server";
import { saveUpload } from "@/lib/infrastructure/storage/file-storage";
import { getFormatByExt, MAX_UPLOAD_BYTES, formatBytes } from "@/lib/domain/media-formats";
import path from "node/path";
import { randomUUID } from "node:crypto";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UploadResult {
  id: string;
  path: string;
  name: string;
  size: number;
  mime: string;
  category: "video" | "audio";
  ext: string;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json<ApiError>({ error: "Expected multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json<ApiError>({ error: "No file uploaded (field name must be 'file')." }, { status: 400 });
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
      { error: `Unsupported format ".${ext}". Supported: mp4,mov,avi,wmv,mkv,flv,webm,mp3,wav,aac,m4a,flac,wma,ogg.` },
      { status: 415 },
    );
  }

  const id = randomUUID();
  const buffer = Buffer.from(await file.arrayBuffer());
  const storedPath = await saveUpload(id, file.name, buffer);

  return NextResponse.json<UploadResult>({
    id,
    path: storedPath,
    name: file.name,
    size: file.size,
    mime: file.type || fmt.mime,
    category: fmt.category,
    ext: fmt.ext,
  });
}
