import { NextResponse } from "next/server";
import { FineTuneService } from "@/lib/application/FineTuneService";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const datasets = await FineTuneService.listDatasets();
  return NextResponse.json({ datasets });
}

interface CreateBody {
  name: string;
  sourceLang: string;
  targetLang: string;
  description?: string;
  samples?: { source: string; target: string }[];
}

export async function POST(request: Request) {
  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json<ApiError>({ error: "Dataset name is required." }, { status: 400 });
  }
  try {
    const dataset = await FineTuneService.createDataset({
      name: body.name,
      sourceLang: body.sourceLang ?? "en",
      targetLang: body.targetLang ?? "hi",
      description: body.description,
    });
    if (body.samples?.length) {
      await FineTuneService.addSamples(dataset.id, body.samples);
    }
    const full = await FineTuneService.getDataset(dataset.id);
    return NextResponse.json(full);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create dataset.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
