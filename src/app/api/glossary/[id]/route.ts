import { NextResponse } from "next/server";
import { GlossaryService } from "@/lib/application/GlossaryService";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UpdateBody {
  source?: string;
  target?: string;
  category?: string;
  note?: string | null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  try {
    const data: Record<string, unknown> = {};
    if (body.source !== undefined) data.source = body.source.trim();
    if (body.target !== undefined) data.target = body.target.trim();
    if (body.category !== undefined) data.category = body.category;
    if (body.note !== undefined) data.note = body.note;
    const entry = await GlossaryService.update(id, data);
    return NextResponse.json(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update glossary entry.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await GlossaryService.remove(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json<ApiError>({ error: "Glossary entry not found." }, { status: 404 });
  }
}
