import { NextResponse } from "next/server";
import { FineTuneService } from "@/lib/application/FineTuneService";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dataset = await FineTuneService.getDataset(id);
  if (!dataset) {
    return NextResponse.json<ApiError>({ error: "Dataset not found." }, { status: 404 });
  }
  return NextResponse.json(dataset);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await FineTuneService.removeDataset(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json<ApiError>({ error: "Dataset not found." }, { status: 404 });
  }
}
