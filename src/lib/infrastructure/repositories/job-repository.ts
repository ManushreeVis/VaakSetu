/** Prisma-backed repository for translation/media/summary/convert jobs (history). */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface JobRecord {
  id: string;
  kind: string;
  status: string;
  progress: number;
  sourceLang: string;
  targetLang: string;
  inputText: string | null;
  inputName: string | null;
  inputPath: string | null;
  inputMime: string | null;
  inputSize: number | null;
  transcript: string | null;
  outputText: string | null;
  outputAudio: string | null;
  outputSrt: string | null;
  outputVtt: string | null;
  summary: string | null;
  model: string | null;
  modelReason: string | null;
  error: string | null;
  durationSec: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const select = {
  id: true,
  kind: true,
  status: true,
  progress: true,
  sourceLang: true,
  targetLang: true,
  inputText: true,
  inputName: true,
  inputPath: true,
  inputMime: true,
  inputSize: true,
  transcript: true,
  outputText: true,
  outputAudio: true,
  outputSrt: true,
  outputVtt: true,
  summary: true,
  model: true,
  modelReason: true,
  error: true,
  durationSec: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const JobRepository = {
  create: (data: Prisma.JobUncheckedCreateInput) => db.job.create({ data, select }),
  getById: (id: string) => db.job.findUnique({ where: { id }, select }),
  list: (opts: { kind?: string; status?: string; q?: string; limit?: number } = {}) => {
    const where: Record<string, unknown> = {};
    if (opts.kind) where.kind = opts.kind;
    if (opts.status) where.status = opts.status;
    if (opts.q) {
      where.OR = [
        { inputText: { contains: opts.q } },
        { outputText: { contains: opts.q } },
        { inputName: { contains: opts.q } },
        { transcript: { contains: opts.q } },
      ];
    }
    return db.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 100,
      select,
    });
  },
  update: (id: string, data: Prisma.JobUncheckedUpdateInput) =>
    db.job.update({ where: { id }, data, select }),
  remove: (id: string) => db.job.delete({ where: { id } }),
  countByStatus: () =>
    db.job.groupBy({ by: ["status"], _count: { _all: true } }),
  countByKind: () => db.job.groupBy({ by: ["kind"], _count: { _all: true } }),
};
