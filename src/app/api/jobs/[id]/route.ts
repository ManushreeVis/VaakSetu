import { NextResponse } from "next/server";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await JobRepository.getById(id);
  if (!job) {
    return NextResponse.json<ApiError>({ error: "Job not found." }, { status: 404 });
  }
  return NextResponse.json(job);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await JobRepository.remove(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json<ApiError>({ error: "Job not found." }, { status: 404 });
  }
}
