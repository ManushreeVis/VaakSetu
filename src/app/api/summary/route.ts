import { NextResponse } from "next/server";
import { Summarizer } from "@/lib/application/Summarizer";
import type { ApiError, SummaryRequest } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: SummaryRequest;
  try {
    body = (await request.json()) as SummaryRequest;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.text?.trim()) {
    return NextResponse.json<ApiError>({ error: "Text is required." }, { status: 400 });
  }
  try {
    const result = await Summarizer.run({
      text: body.text,
      sourceLang: body.sourceLang ?? "auto",
      targetLang: body.targetLang ?? "en",
      style: body.style ?? "bullets",
      length: body.length ?? "medium",
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summarization failed.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
