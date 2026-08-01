import { NextResponse } from "next/server";
import { ChatRepository } from "@/lib/infrastructure/repositories/chat-repository";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await ChatRepository.getSession(id);
  if (!session) {
    return NextResponse.json<ApiError>({ error: "Session not found." }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await ChatRepository.removeSession(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json<ApiError>({ error: "Session not found." }, { status: 404 });
  }
}
