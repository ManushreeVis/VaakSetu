# VaakSetu — Fine-tuning IndicTrans2

This guide covers adapting **IndicTrans2** (AI4Bharat, MIT-licensed) to BAIF's domain
(agriculture, rural development, extension vocabulary) using parallel sentence corpora.

The in-app **Fine-tune** view (FinetuneView) manages datasets and training jobs through the same
UX; in this sandbox the training loop is simulated. In production, starting a training job
launches the real fairseq recipe below.

## 1. Why fine-tune?

IndicTrans2 is strong on general text, but BAIF content has domain-specific terms
(*krishi sanket*, *pani sinchan*, *sheti samaan*, extension-programme names). A lightweight
**LoRA / adapter** fine-tune on a few thousand parallel sentences measurably improves fidelity for
these terms — at near-zero cost on a single 8 GB GPU.

## 2. Prepare a parallel corpus

Collect 1k–20k sentence pairs (source ||| target), one per line. Sources:
- BAIF field manuals (Marathi/Hindi/English editions)
- Existing translated extension pamphlets
- Transcribed + human-corrected training videos

The in-app Finetune view lets you paste pairs as `source ||| target` or add them one-by-one.
Export to TSV for the fairseq pipeline:

```bash
# Export from the app (or build manually): train.mr-hi.tsv with columns src \t tgt
```

## 3. Tokenisation + BPE (IndicTrans2 uses sentencepiece + the Indic script converter)

```bash
git clone https://github.com/AI4Bharat/IndicTrans2
cd IndicTrans2

# Normalise Indic scripts to Devanagari where needed
python scripts/normalize_punctuation.py --src mr --tgt hi < train.tsv > train.norm.tsv

# Apply the released sentencepiece model + BPE
python scripts/bpe_train.py --inp train.norm.tsv --vocab models/indictrans2/vocab
```

## 4. Launch fine-tuning (fairseq)

```bash
fairseq-train data-bin/indictrans2-mr-hi \
  --user-dir indicTrans_repo/indicTrans \
  --arch indictrans \
  --task translation \
  --criterion label_smoothed_cross_entropy --label-smoothing 0.1 \
  --optimizer adam --adam-betas '(0.9, 0.98)' --clip-norm 1.0 \
  --lr 1e-4 --lr-scheduler inverse_sqrt --warmup-updates 4000 \
  --dropout 0.2 --attention-dropout 0.1 \
  --max-tokens 4000 --update-freq 2 \
  --max-epoch 3 \
  --save-dir checkpoints/baif-mr-hi \
  --restore-file models/indictrans2/checkpoint.pt --reset-optimizer --reset-dataloader --reset-meters \
  --fp16
```

Key defaults mirrored in the in-app form: **epochs 3, lr 1e-4, batch 16** (tokens adjusted via
`--max-tokens`).

## 5. Produce a portable adapter

For lightweight deployment, convert the fine-tuned checkpoint to a HuggingFace / ONNX adapter:

```bash
# Export to HF format
python scripts/convert_fairseq_to_hf.py \
  --fairseq-path checkpoints/baif-mr-hi/checkpoint_best.pt \
  --hf-path models/indictrans2-baif-mr-hi

# Optional: quantise to INT8 for CPU-only field laptops
python scripts/quantize_onnx.py --in models/indictrans2-baif-mr-hi --int8
```

Drop the result into `models/indictrans2-baif-mr-hi/` and select it from the in-app **Models**
view (or set `TRANSLATION_MODEL=indictrans2-baif-mr-hi`).

## 6. Evaluate

Measure BLEU / chrF on a held-out 200-sentence BAIF test set before vs after fine-tuning. Expect
+2 to +6 BLEU on domain vocabulary. The in-app Fine-tune job log surfaces epoch/loss; wire your
eval script into the job's `outputRef` for a complete report.

## 7. Iterative improvement

- Tag weak outputs in the **History** view, export them as candidate correction pairs, and add to
  the next dataset.
- Re-run fine-tuning weekly/monthly as the corpus grows. The adapter approach keeps each run cheap.
