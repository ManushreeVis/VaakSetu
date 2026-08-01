import { NextResponse } from "next/server";
import { GlossaryService } from "@/lib/application/GlossaryService";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sourceLang = url.searchParams.get("sourceLang") ?? undefined;
  const targetLang = url.searchParams.get("targetLang") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const entries = await GlossaryService.list({ sourceLang, targetLang, category, q });
  return NextResponse.json({ entries });
}

interface CreateBody {
  sourceLang: string;
  targetLang: string;
  source: string;
  target: string;
  category?: string;
  note?: string;
}

export async function POST(request: Request) {
  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.source?.trim() || !body.target?.trim()) {
    return NextResponse.json<ApiError>({ error: "source and target terms are required." }, { status: 400 });
  }
  if (!body.sourceLang || !body.targetLang) {
    return NextResponse.json<ApiError>({ error: "sourceLang and targetLang are required." }, { status: 400 });
  }
  try {
    const entry = await GlossaryService.create({
      sourceLang: body.sourceLang,
      targetLang: body.targetLang,
      source: body.source.trim(),
      target: body.target.trim(),
      category: body.category ?? "general",
      note: body.note ?? null,
    });
    return NextResponse.json(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create glossary entry.";
    // Prisma unique-constraint violation
    if (message.includes("Unique constraint")) {
      return NextResponse.json<ApiError>(
        { error: "A glossary entry for this source term + language pair already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
