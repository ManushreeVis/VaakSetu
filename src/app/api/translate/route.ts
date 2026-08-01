import { NextResponse } from "next/server";
import { TextTranslator } from "@/lib/application/TextTranslator";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TranslateBody {
  text: string;
  sourceLang: string;
  targetLang: string;
  modelId?: string;
}

export async function POST(request: Request) {
  let body: TranslateBody;
  try {
    body = (await request.json()) as TranslateBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.text?.trim()) {
    return NextResponse.json<ApiError>({ error: "Text is required." }, { status: 400 });
  }
  if (!body.targetLang) {
    return NextResponse.json<ApiError>({ error: "Target language is required." }, { status: 400 });
  }
  try {
    const result = await TextTranslator.run({
      text: body.text,
      sourceLang: body.sourceLang ?? "auto",
      targetLang: body.targetLang,
      modelId: body.modelId,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Translation failed.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
