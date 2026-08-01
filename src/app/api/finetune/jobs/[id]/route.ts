import { NextResponse } from "next/server";
import { FineTuneService } from "@/lib/application/FineTuneService";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await FineTuneService.getJob(id);
  if (!job) {
    return NextResponse.json<ApiError>({ error: "Training job not found." }, { status: 404 });
  }
  return NextResponse.json(job);
}
