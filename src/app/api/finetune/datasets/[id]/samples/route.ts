import { NextResponse } from "next/server";
import { FineTuneService } from "@/lib/application/FineTuneService";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SamplesBody {
  samples: { source: string; target: string }[];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: SamplesBody;
  try {
    body = (await request.json()) as SamplesBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!Array.isArray(body.samples) || body.samples.length === 0) {
    return NextResponse.json<ApiError>({ error: "samples[] is required." }, { status: 400 });
  }
  try {
    const dataset = await FineTuneService.addSamples(
      id,
      body.samples.filter((s) => s.source?.trim() && s.target?.trim()),
    );
    if (!dataset) {
      return NextResponse.json<ApiError>({ error: "Dataset not found." }, { status: 404 });
    }
    return NextResponse.json(dataset);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add samples.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
