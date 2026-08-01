import { NextResponse } from "next/server";
import { ChatRepository } from "@/lib/infrastructure/repositories/chat-repository";
import { DocumentChatService } from "@/lib/application/DocumentChatService";
import { saveUpload } from "@/lib/infrastructure/storage/file-storage";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await ChatRepository.getSession(id);
  if (!session) {
    return NextResponse.json<ApiError>({ error: "Session not found." }, { status: 404 });
  }

  let question = "";
  let audioPath: string | undefined;
  let speakReply = false;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    question = String(form.get("question") ?? "");
    speakReply = form.get("speak") === "true";
    const file = form.get("audio");
    if (file instanceof File) {
      const buf = Buffer.from(await file.arrayBuffer());
      audioPath = await saveUpload(`voice-${id}`, `input-${Date.now()}.wav`, buf);
    }
  } else {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json<ApiError>({ error: "Invalid body." }, { status: 400 });
    }
    question = String(body.question ?? "");
    speakReply = Boolean(body.speak);
  }

  try {
    const result = await DocumentChatService.send({
      sessionId: id,
      question,
      audioPath,
      speakReply,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send message.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
