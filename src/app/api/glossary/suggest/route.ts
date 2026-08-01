import { NextResponse } from "next/server";
import { GlossaryService } from "@/lib/application/GlossaryService";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sourceLang = url.searchParams.get("sourceLang");
  const targetLang = url.searchParams.get("targetLang");
  const limit = Number(url.searchParams.get("limit") ?? 12);

  if (!sourceLang || !targetLang) {
    return NextResponse.json<ApiError>(
      { error: "sourceLang and targetLang query parameters are required." },
      { status: 400 },
    );
  }

  try {
    const suggestions = await GlossaryService.suggestFromHistory({
      sourceLang,
      targetLang,
      limit,
    });
    return NextResponse.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate suggestions.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
