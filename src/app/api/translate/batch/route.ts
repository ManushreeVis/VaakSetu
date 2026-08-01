import { NextResponse } from "next/server";
import { TextTranslator, type BatchTranslationResult } from "@/lib/application/TextTranslator";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BatchBody {
  sources: string[];
  sourceLang: string;
  targetLang: string;
}

const MAX_BATCH_LINES = 200;

export async function POST(request: Request) {
  let body: BatchBody;
  try {
    body = (await request.json()) as BatchBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!Array.isArray(body.sources) || body.sources.length === 0) {
    return NextResponse.json<ApiError>({ error: "sources[] must be a non-empty array." }, { status: 400 });
  }
  if (body.sources.length > MAX_BATCH_LINES) {
    return NextResponse.json<ApiError>(
      { error: `Batch too large: max ${MAX_BATCH_LINES} lines, got ${body.sources.length}.` },
      { status: 413 },
    );
  }
  if (!body.targetLang) {
    return NextResponse.json<ApiError>({ error: "targetLang is required." }, { status: 400 });
  }
  try {
    const result: BatchTranslationResult = await TextTranslator.runBatch({
      sources: body.sources,
      sourceLang: body.sourceLang ?? "auto",
      targetLang: body.targetLang,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Batch translation failed.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
