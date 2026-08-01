import { NextResponse } from "next/server";
import { CaptionBurner } from "@/lib/application/CaptionBurner";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await CaptionBurner.run(id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to burn captions.";
    const status = message.includes("not found") || message.includes("no SRT") || message.includes("only available") ? 400 : 500;
    return NextResponse.json<ApiError>({ error: message }, { status });
  }
}
