import { NextResponse } from "next/server";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import { FineTuneRepository } from "@/lib/infrastructure/repositories/finetune-repository";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [byStatus, byKind, total, fineTuneDatasets, fineTuneJobsRunning] = await Promise.all([
    JobRepository.countByStatus(),
    JobRepository.countByKind(),
    db.job.count(),
    FineTuneRepository.listDatasets(),
    db.fineTuneJob.count({ where: { status: "running" } }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) statusCounts[row.status] = row._count._all;
  const kindCounts: Record<string, number> = {};
  for (const row of byKind) kindCounts[row.kind] = row._count._all;

  return NextResponse.json({
    totalJobs: total,
    statusCounts,
    kindCounts,
    fineTuneDatasets: fineTuneDatasets.length,
    fineTuneSamples: fineTuneDatasets.reduce((a, d) => a + d._count.samples, 0),
    fineTuneJobsRunning,
  });
}
