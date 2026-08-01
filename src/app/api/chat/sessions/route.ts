import { NextResponse } from "next/server";
import { ChatRepository } from "@/lib/infrastructure/repositories/chat-repository";
import { DocumentChatService } from "@/lib/application/DocumentChatService";
import { saveUpload } from "@/lib/infrastructure/storage/file-storage";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = await ChatRepository.listSessions();
  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  let title = "New document chat";
  let sourceLang = "auto";
  let targetLang = "en";
  let documentText: string | undefined;
  let documentName: string | undefined;
  let documentPath: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    title = String(form.get("title") ?? title);
    sourceLang = String(form.get("sourceLang") ?? sourceLang);
    targetLang = String(form.get("targetLang") ?? targetLang);
    documentText = form.get("documentText") ? String(form.get("documentText")) : undefined;
    const file = form.get("file");
    if (file instanceof File) {
      const buf = Buffer.from(await file.arrayBuffer());
      documentPath = await saveUpload(`doc-${Date.now()}`, file.name, buf);
      documentName = file.name;
    }
  } else {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json<ApiError>({ error: "Invalid body." }, { status: 400 });
    }
    title = String(body.title ?? title);
    sourceLang = String(body.sourceLang ?? sourceLang);
    targetLang = String(body.targetLang ?? targetLang);
    documentText = body.documentText ? String(body.documentText) : undefined;
  }

  try {
    const session = await DocumentChatService.createSession({
      title,
      sourceLang,
      targetLang,
      documentText,
      documentName,
      documentPath,
    });
    return NextResponse.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create chat session.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
