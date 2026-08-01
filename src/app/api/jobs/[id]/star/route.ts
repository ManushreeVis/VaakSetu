import { NextResponse } from "next/server";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StarBody {
  starred: boolean;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: StarBody;
  try {
    body = (await request.json()) as StarBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.starred !== "boolean") {
    return NextResponse.json<ApiError>({ error: "starred (boolean) is required." }, { status: 400 });
  }
  try {
    const job = await JobRepository.toggleStar(id, body.starred);
    return NextResponse.json(job);
  } catch {
    return NextResponse.json<ApiError>({ error: "Job not found." }, { status: 404 });
  }
}
