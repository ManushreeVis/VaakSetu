import { NextResponse } from "next/server";
import { FineTuneService } from "@/lib/application/FineTuneService";
import type { ApiError } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await FineTuneService.listJobs();
  return NextResponse.json({ jobs });
}

interface TrainBody {
  datasetId: string;
  baseModel?: string;
  epochs?: number;
  learningRate?: number;
  batchSize?: number;
}

export async function POST(request: Request) {
  let body: TrainBody;
  try {
    body = (await request.json()) as TrainBody;
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.datasetId) {
    return NextResponse.json<ApiError>({ error: "datasetId is required." }, { status: 400 });
  }
  try {
    const job = await FineTuneService.startTraining({
      datasetId: body.datasetId,
      baseModel: body.baseModel ?? "indictrans2",
      epochs: body.epochs ?? 3,
      learningRate: body.learningRate ?? 0.0001,
      batchSize: body.batchSize ?? 16,
    });
    return NextResponse.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start training.";
    return NextResponse.json<ApiError>({ error: message }, { status: 500 });
  }
}
