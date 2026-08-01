import { NextResponse } from "next/server";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";
import { FineTuneRepository } from "@/lib/infrastructure/repositories/finetune-repository";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DailyCountRow {
  day: string;
  count: bigint;
}

/** Build the last N days (YYYY-MM-DD) including today, oldest first. */
const lastNDays = (n: number): string[] => {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
};

export async function GET() {
  const [byStatus, byKind, total, fineTuneDatasets, fineTuneJobsRunning, glossaryCount] = await Promise.all([
    JobRepository.countByStatus(),
    JobRepository.countByKind(),
    db.job.count(),
    FineTuneRepository.listDatasets(),
    db.fineTuneJob.count({ where: { status: "running" } }),
    db.glossaryEntry.count(),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) statusCounts[row.status] = row._count._all;
  const kindCounts: Record<string, number> = {};
  for (const row of byKind) kindCounts[row.kind] = row._count._all;

  // Jobs per day for the last 14 days (SQLite: strftime on createdAt).
  const days = lastNDays(14);
  const dayMap: Record<string, number> = {};
  for (const d of days) dayMap[d] = 0;
  try {
    const rows: DailyCountRow[] = await db.$queryRaw`
      SELECT strftime('%Y-%m-%d', "createdAt") AS day, COUNT(*) AS count
      FROM "Job"
      WHERE "createdAt" >= date('now', '-14 days')
      GROUP BY day
      ORDER BY day ASC
    `;
    for (const row of rows) {
      const day = String(row.day);
      if (day in dayMap) dayMap[day] = Number(row.count);
    }
  } catch {
    // Fall back to empty chart if the raw query is unavailable.
  }
  const jobsPerDay = days.map((d) => ({ day: d, count: dayMap[d] }));

  return NextResponse.json({
    totalJobs: total,
    statusCounts,
    kindCounts,
    fineTuneDatasets: fineTuneDatasets.length,
    fineTuneSamples: fineTuneDatasets.reduce((a, d) => a + d._count.samples, 0),
    fineTuneJobsRunning,
    glossaryCount,
    jobsPerDay,
  });
}
