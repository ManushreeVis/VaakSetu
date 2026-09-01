import { NextResponse } from "next/server";
import { VideoDubber } from "@/lib/application/VideoDubber";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let duckOriginal = false;

  try {
    const body = await request.json().catch(() => ({}));
    duckOriginal = Boolean(body?.duckOriginal);
  } catch {
    // default
  }

  try {
    const result = await VideoDubber.run(id, duckOriginal);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video dubbing failed.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
