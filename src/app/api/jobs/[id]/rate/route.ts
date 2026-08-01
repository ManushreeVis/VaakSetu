import { NextResponse } from "next/server";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RateBody {
  /** "up" | "down" | null (null clears the rating) */
  rating: "up" | "down" | null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: RateBody;
  try {
    body = (await request.json()) as RateBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (body.rating !== null && body.rating !== "up" && body.rating !== "down") {
    return NextResponse.json<ApiError>(
      { error: "rating must be 'up', 'down', or null." },
      { status: 400 },
    );
  }
  try {
    const job = await JobRepository.setRating(id, body.rating);
    return NextResponse.json(job);
  } catch {
    return NextResponse.json<ApiError>({ error: "Job not found." }, { status: 404 });
  }
}
