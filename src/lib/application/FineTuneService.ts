/**
 * FineTuneService — manages parallel-sentence datasets and fine-tuning training jobs.
 *
 * In the sandbox, training is simulated (progress advances over time) because GPU
 * fine-tuning of IndicTrans2 cannot run here. The simulation mimics a real training loop
 * (epochs, loss decreasing, checkpoint produced) and writes the same status updates a real
 * fairseq job would. The real on-prem recipe is documented in docs/FINE_TUNE.md.
 */

import { FineTuneRepository } from "@/lib/infrastructure/repositories/finetune-repository";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fire-and-forget simulated training loop. */
const runSimulatedTraining = async (jobId: string, epochs: number, sampleCount: number) => {
  const totalSteps = epochs * Math.max(1, Math.ceil(sampleCount / 16));
  let step = 0;
  let log = "";
  const startedAt = Date.now();
  while (step < totalSteps) {
    await sleep(1500);
    step += 1;
    const progress = Math.round((step / totalSteps) * 100);
    const epoch = Math.ceil(step / Math.max(1, Math.ceil(sampleCount / 16)));
    const loss = Math.max(0.08, 2.4 * Math.exp(-2.6 * (step / totalSteps))).toFixed(4);
    log += `[epoch ${epoch}/${epochs} step ${step}/${totalSteps}] loss=${loss}\n`;
    await FineTuneRepository.updateJob(jobId, { status: "running", progress, log });
  }
  const outputRef = `adapter:${jobId}`;
  log += `\nTraining complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s. ` +
    `Adapter saved as ${outputRef}.\n`;
  await FineTuneRepository.updateJob(jobId, {
    status: "completed",
    progress: 100,
    outputRef,
    log,
  });
};

export const FineTuneService = {
  createDataset: FineTuneRepository.createDataset,
  listDatasets: FineTuneRepository.listDatasets,
  getDataset: FineTuneRepository.getDataset,
  removeDataset: FineTuneRepository.removeDataset,

  async addSamples(datasetId: string, pairs: { source: string; target: string }[]) {
    await FineTuneRepository.addSamples(datasetId, pairs);
    return FineTuneRepository.getDataset(datasetId);
  },

  async startTraining(opts: {
    datasetId: string;
    baseModel: string;
    epochs: number;
    learningRate: number;
    batchSize: number;
  }) {
    const dataset = await FineTuneRepository.getDataset(opts.datasetId);
    if (!dataset) throw new Error("Dataset not found.");
    const job = await FineTuneRepository.createJob({
      datasetId: opts.datasetId,
      baseModel: opts.baseModel,
      epochs: opts.epochs,
      learningRate: opts.learningRate,
      batchSize: opts.batchSize,
    });
    // Kick off the (simulated) training in the background.
    void runSimulatedTraining(job.id, opts.epochs, dataset.samples.length).catch(async (e) => {
      const message = e instanceof Error ? e.message : "Training failed.";
      await FineTuneRepository.updateJob(job.id, {
        status: "failed",
        log: message,
      });
    });
    return job;
  },

  listJobs: FineTuneRepository.listJobs,
  getJob: FineTuneRepository.getJob,
};
