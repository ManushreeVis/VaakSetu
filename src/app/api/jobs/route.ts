import { NextResponse } from "next/server";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const jobs = await JobRepository.list({ kind, status, q, limit });
  return NextResponse.json({ jobs });
}
