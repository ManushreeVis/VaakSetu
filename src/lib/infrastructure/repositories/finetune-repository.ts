/** Prisma-backed repository for fine-tune datasets, samples, and training jobs. */

import { db } from "@/lib/db";

export const FineTuneRepository = {
  // --- datasets ---
  createDataset: (data: { name: string; sourceLang: string; targetLang: string; description?: string }) =>
    db.fineTuneDataset.create({ data, include: { samples: true } }),

  listDatasets: () =>
    db.fineTuneDataset.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { samples: true, jobs: true } } },
    }),

  getDataset: (id: string) =>
    db.fineTuneDataset.findUnique({
      where: { id },
      include: { samples: { orderBy: { createdAt: "asc" } }, jobs: { orderBy: { createdAt: "desc" } } },
    }),

  addSamples: (datasetId: string, pairs: { source: string; target: string }[]) =>
    db.fineTuneSample.createMany({ data: pairs.map((p) => ({ ...p, datasetId })) }),

  removeDataset: (id: string) => db.fineTuneDataset.delete({ where: { id } }),

  // --- training jobs ---
  createJob: (data: {
    datasetId: string;
    baseModel: string;
    epochs?: number;
    learningRate?: number;
    batchSize?: number;
  }) => db.fineTuneJob.create({ data }),

  getJob: (id: string) => db.fineTuneJob.findUnique({ where: { id } }),

  listJobs: () => db.fineTuneJob.findMany({ orderBy: { createdAt: "desc" }, include: { dataset: true } }),

  updateJob: (id: string, data: Record<string, unknown>) =>
    db.fineTuneJob.update({ where: { id }, data }),
};
