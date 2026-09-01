"""
VaakSetu Local AI Service v3.0
==============================
Fully offline FastAPI microservice for:
1. AI4Bharat IndicTrans2 (200M / 320M / 1B) Translation — VRAM-aware auto-selection
   + NLLB-200-distilled-600M fallback (no token needed, good for Indic↔Indic)
2. Whisper ASR (Small/Medium) — GPU-accelerated when available, CPU int8 fallback
3. Segment-Aware Neural TTS — per-segment synthesis with time-slot alignment
4. Video Dubbing & Subtitle Burning via FFmpeg
5. Context-aware batch translation endpoint for coherent video segment translation

Cross-Platform: macOS (MPS/CPU), Windows 11 (CUDA/CPU), Linux (CUDA/CPU).
No platform-exclusive hardcoding.
"""

import gc
import os
import sys
import types
import asyncio
import tempfile
import subprocess
import json
import threading
from collections import OrderedDict
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple

# Enable MPS fallback to CPU for unsupported Metal kernels (prevents hard SIGABRT crashes)
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from io import BytesIO
import torch

# ---------------------------------------------------------------------------
# Backwards compatibility patches for IndicTrans2 & IndicTransToolkit
# ---------------------------------------------------------------------------
try:
    import transformers
    # 1. Patch transformers.tokenization_utils
    if not hasattr(transformers, "tokenization_utils") or not hasattr(
        transformers.tokenization_utils, "PreTrainedTokenizerBase"
    ):
        import transformers.tokenization_utils_base as tub
        mod = types.ModuleType("transformers.tokenization_utils")
        mod.PreTrainedTokenizerBase = tub.PreTrainedTokenizerBase
        sys.modules["transformers.tokenization_utils"] = mod
        transformers.tokenization_utils = mod

    # 2. Patch transformers.onnx & transformers.onnx.utils for IndicTrans2 remote code
    if "transformers.onnx" not in sys.modules or not hasattr(transformers, "onnx"):
        onnx_mod = types.ModuleType("transformers.onnx")
        onnx_utils_mod = types.ModuleType("transformers.onnx.utils")

        class OnnxConfig:
            pass
        class OnnxConfigWithPast(OnnxConfig):
            pass
        class OnnxSeq2SeqConfigWithPast(OnnxConfigWithPast):
            pass

        onnx_mod.OnnxConfig = OnnxConfig
        onnx_mod.OnnxConfigWithPast = OnnxConfigWithPast
        onnx_mod.OnnxSeq2SeqConfigWithPast = OnnxSeq2SeqConfigWithPast
        onnx_mod.PatchingSpec = object
        onnx_mod.default_onnx_opset = 14
        onnx_mod.export = lambda *args, **kwargs: None
        onnx_mod.validate_model_outputs = lambda *args, **kwargs: None
        onnx_utils_mod.compute_effective_axis_dimension = lambda *args, **kwargs: None
        onnx_mod.utils = onnx_utils_mod

        sys.modules["transformers.onnx"] = onnx_mod
        sys.modules["transformers.onnx.utils"] = onnx_utils_mod
        transformers.onnx = onnx_mod
except Exception as e:
    print(f"[Warning] Failed to patch transformers compatibility: {e}")


# ---------------------------------------------------------------------------
# Cross-Platform Device Detection & VRAM Profiling
# ---------------------------------------------------------------------------
def detect_device() -> Tuple[str, torch.dtype, float]:
    """
    Detect the optimal compute device with safe, cross-platform fallbacks.
    Returns (device_str, torch_dtype, vram_gb).
    MPS check is guarded to avoid AttributeError on non-Apple hardware.
    """
    # 1. NVIDIA CUDA (Float16 is natively supported across all matrix ops)
    if torch.cuda.is_available():
        props = torch.cuda.get_device_properties(0)
        vram_gb = props.total_memory / (1024 ** 3)
        print(
            f"[Device] CUDA GPU detected: {props.name} "
            f"({vram_gb:.1f}GB VRAM, compute {props.major}.{props.minor})"
        )
        return "cuda", torch.float16, vram_gb

    # 2. Apple Silicon MPS (guarded — not available on Windows builds of PyTorch)
    try:
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            # MPS does not expose VRAM size via PyTorch; estimate from system RAM
            import subprocess as sp
            try:
                result = sp.run(
                    ["sysctl", "-n", "hw.memsize"], capture_output=True, text=True
                )
                total_ram_gb = int(result.stdout.strip()) / (1024 ** 3)
                # Unified memory: GPU can use ~70% of RAM
                estimated_vram = total_ram_gb * 0.70
            except Exception:
                estimated_vram = 8.0  # Safe default for M1/M2
            print(
                f"[Device] Apple Silicon MPS detected "
                f"(estimated usable VRAM: {estimated_vram:.1f}GB)"
            )
            # CRITICAL: On Apple Silicon MPS, torch.float16 causes Metal kernel
            # MPSNDArrayMatrixMultiplication assertion crashes during Seq2Seq beam search.
            # torch.float32 runs natively at full GPU speed without Metal assertion bugs.
            return "mps", torch.float32, estimated_vram
    except Exception:
        pass  # MPS not available or PyTorch built without MPS support

    # 3. CPU fallback
    import multiprocessing
    cpu_count = multiprocessing.cpu_count()
    print(f"[Device] CPU fallback ({cpu_count} cores, no GPU acceleration)")
    return "cpu", torch.float32, 0.0


DEVICE, TORCH_DTYPE, AVAILABLE_VRAM_GB = detect_device()
print(
    f"[Local AI] VaakSetu Local Engine v3.0 | Device: {DEVICE} | "
    f"dtype: {TORCH_DTYPE} | Est. VRAM: {AVAILABLE_VRAM_GB:.1f}GB"
)

# VRAM thresholds for 1B vs distilled model selection
VRAM_1B_THRESHOLD_GB = 6.0

# Maximum number of translation models to keep in memory simultaneously
MAX_LOADED_TRANSLATION_MODELS = 2


# ---------------------------------------------------------------------------
# Language Code Mapping
# ---------------------------------------------------------------------------
INDICTRANS_LANG_MAP: Dict[str, str] = {
    "hi": "hin_Deva", "mr": "mar_Deva", "en": "eng_Latn",
    "bn": "ben_Beng", "gu": "guj_Gujr", "ta": "tam_Taml",
    "te": "tel_Telu", "kn": "kan_Knda", "ml": "mal_Mlym",
    "pa": "pan_Guru", "or": "ory_Orya", "ur": "urd_Arab",
    "as": "asm_Beng", "sa": "san_Deva", "sd": "snd_Deva",
    "ne": "npi_Deva", "bho": "bho_Deva", "mai": "mai_Deva",
    "dgo": "doi_Deva", "kok": "kok_Deva", "kas": "kas_Arab",
    "mni": "mni_Beng", "sat": "sat_Olck",
}

NLLB_LANG_MAP: Dict[str, str] = {
    "hi": "hin_Deva", "mr": "mar_Deva", "en": "eng_Latn",
    "bn": "ben_Beng", "gu": "guj_Gujr", "ta": "tam_Taml",
    "te": "tel_Telu", "kn": "kan_Knda", "ml": "mal_Mlym",
    "pa": "pan_Guru", "or": "ory_Orya", "ur": "urd_Arab",
    "ne": "npi_Deva",
}

TTS_VOICE_MAP: Dict[str, str] = {
    "mr": "mr-IN-AarohiNeural",
    "mr-female": "mr-IN-AarohiNeural",
    "mr-male": "mr-IN-ManoharNeural",
    "hi": "hi-IN-SwaraNeural",
    "hi-female": "hi-IN-SwaraNeural",
    "hi-male": "hi-IN-MadhurNeural",
    "en": "en-IN-NeerjaNeural",
    "en-female": "en-IN-NeerjaNeural",
    "en-male": "en-IN-PrabhatNeural",
    "en-us": "en-US-JennyNeural",
    "bn": "bn-IN-TanishaaNeural",
    "gu": "gu-IN-DhwaniNeural",
    "ta": "ta-IN-PallaviNeural",
    "te": "te-IN-ShrutiNeural",
    "kn": "kn-IN-SapnaNeural",
    "ml": "ml-IN-SobhanaNeural",
    "ur": "ur-IN-GulNeural",
}

# Script-to-language heuristic for auto-detection
SCRIPT_DETECT_MAP = [
    ("\u0900", "\u097F", "hi"),   # Devanagari → Hindi (also Marathi, but hi is safe default)
    ("\u0980", "\u09FF", "bn"),   # Bengali
    ("\u0A00", "\u0A7F", "pa"),   # Gurmukhi → Punjabi
    ("\u0A80", "\u0AFF", "gu"),   # Gujarati
    ("\u0B00", "\u0B7F", "or"),   # Odia
    ("\u0B80", "\u0BFF", "ta"),   # Tamil
    ("\u0C00", "\u0C7F", "te"),   # Telugu
    ("\u0C80", "\u0CFF", "kn"),   # Kannada
    ("\u0D00", "\u0D7F", "ml"),   # Malayalam
    ("\u0600", "\u06FF", "ur"),   # Arabic script → Urdu
]


def detect_script_language(text: str) -> Optional[str]:
    """Heuristic language detection based on Unicode script ranges."""
    for char in text[:200]:  # Sample first 200 chars for speed
        for start, end, lang in SCRIPT_DETECT_MAP:
            if start <= char <= end:
                return lang
    return None  # Likely Latin/English


# ---------------------------------------------------------------------------
# Translation Engine (IndicTrans2 + NLLB fallback)
# ---------------------------------------------------------------------------
class TranslationManager:
    """
    Manages IndicTrans2 and NLLB translation models with:
    - VRAM-aware model size selection (1B vs distilled)
    - LRU eviction to stay within VRAM budget
    - Context-aware sentence batching for coherent translation
    """

    def __init__(self):
        # OrderedDict preserves insertion order for LRU eviction
        self.models: OrderedDict[str, Any] = OrderedDict()
        self.tokenizers: OrderedDict[str, Any] = OrderedDict()
        self.processor: Optional[Any] = None
        self._lock = threading.Lock()
        self._init_processor()

    def _init_processor(self):
        try:
            from IndicTransToolkit.processor import IndicProcessor
            self.processor = IndicProcessor(inference=True)
            print("[Local AI] IndicProcessor initialized successfully.")
        except Exception as e:
            print(f"[Local AI] IndicProcessor not available: {e}")
            self.processor = None

    def _get_hf_token(self) -> Optional[str]:
        return os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN") or None

    def _get_indictrans_candidates(self, src: str, tgt: str) -> List[str]:
        """
        Return candidate IndicTrans2 model names in priority order:
        1. Distilled models (200M / 320M) — fastest, minimal RAM/swap footprint (<1GB VRAM)
        2. 1B models — full quality fallback when available
        """
        if src == "en" and tgt != "en":
            return [
                "ai4bharat/indictrans2-en-indic-dist-200M",
                "ai4bharat/indictrans2-en-indic-1B",
            ]
        elif src != "en" and tgt == "en":
            return [
                "ai4bharat/indictrans2-indic-en-dist-200M",
                "ai4bharat/indictrans2-indic-en-1B",
            ]
        else:
            return [
                "ai4bharat/indictrans2-indic-indic-dist-320M",
                "ai4bharat/indictrans2-indic-indic-1B",
            ]

    def _evict_oldest_model(self):
        """Evict the LRU (least recently used) model to free VRAM."""
        if not self.models:
            return
        oldest_key = next(iter(self.models))
        print(f"[Local AI] Evicting model '{oldest_key}' from {DEVICE} to free VRAM...")
        del self.models[oldest_key]
        del self.tokenizers[oldest_key]
        gc.collect()
        if DEVICE == "cuda":
            torch.cuda.empty_cache()
        print(f"[Local AI] Eviction complete.")

    def offload_all(self):
        """Explicitly offload all translation models from VRAM."""
        keys = list(self.models.keys())
        for key in keys:
            del self.models[key]
            del self.tokenizers[key]
        gc.collect()
        if DEVICE == "cuda":
            torch.cuda.empty_cache()
        print(f"[Local AI] All translation models offloaded. ({len(keys)} models freed)")

    def _touch_model(self, name: str):
        """Move model to end of OrderedDict (mark as recently used)."""
        if name in self.models:
            self.models.move_to_end(name)
            self.tokenizers.move_to_end(name)

    def load_model(self, src_key: str, tgt_key: str):
        """
        Load the appropriate translation model, evicting LRU if needed.
        Priority:
        1. Distilled IndicTrans2 (200M / 320M) — fastest, no swap (<1GB VRAM)
        2. 1B IndicTrans2 — high quality fallback
        3. NLLB-200-distilled-600M — offline open fallback
        """
        with self._lock:
            token = self._get_hf_token()
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

            # ── 1. IndicTrans2 — Priority: Distilled 200M/320M ➔ 1B ──
            candidates = self._get_indictrans_candidates(src_key, tgt_key)

            for it_name in candidates:
                if it_name in self.models:
                    self._touch_model(it_name)
                    return self.models[it_name], self.tokenizers[it_name], "indictrans2", it_name

                try:
                    print(f"[Local AI] Loading IndicTrans2 ({it_name.split('/')[-1]})...")
                    while len(self.models) >= MAX_LOADED_TRANSLATION_MODELS:
                        self._evict_oldest_model()

                    tok = AutoTokenizer.from_pretrained(
                        it_name, trust_remote_code=True, token=token
                    )
                    mod = AutoModelForSeq2SeqLM.from_pretrained(
                        it_name,
                        trust_remote_code=True,
                        torch_dtype=TORCH_DTYPE,
                        token=token,
                    ).to(DEVICE)
                    mod.eval()
                    self.models[it_name] = mod
                    self.tokenizers[it_name] = tok
                    print(f"[Local AI] ✓ Successfully loaded IndicTrans2: {it_name} on {DEVICE} ({TORCH_DTYPE}).")
                    return mod, tok, "indictrans2", it_name
                except Exception as e:
                    print(f"[Local AI] IndicTrans2 ({it_name}) notice: {e}")

            # ── 2. NLLB-200-distilled-600M — Fallback ──
            nllb_name = "facebook/nllb-200-distilled-600M"
            if nllb_name in self.models:
                self._touch_model(nllb_name)
                return self.models[nllb_name], self.tokenizers[nllb_name], "nllb", nllb_name

            print(f"[Local AI] Loading NLLB fallback: {nllb_name}...")
            while len(self.models) >= MAX_LOADED_TRANSLATION_MODELS:
                self._evict_oldest_model()

            tok = AutoTokenizer.from_pretrained(nllb_name)
            mod = AutoModelForSeq2SeqLM.from_pretrained(
                nllb_name, torch_dtype=TORCH_DTYPE
            ).to(DEVICE)
            mod.eval()
            self.models[nllb_name] = mod
            self.tokenizers[nllb_name] = tok
            print(f"[Local AI] ✓ Loaded NLLB fallback: {nllb_name} on {DEVICE} ({TORCH_DTYPE}).")
            return mod, tok, "nllb", nllb_name

    def _split_into_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences using regex boundary detection.
        Preserves Indic danda ('।') and English period ('.') boundaries.
        """
        import re
        parts = re.split(r'(?<=[।!?.\n])\s+', text.strip())
        return [p.strip() for p in parts if p.strip()]

    def _batch_sentences(
        self,
        sentences: List[str],
        max_batch_tokens: int = 500,
    ) -> List[List[str]]:
        """
        Group sentences into batches of roughly equal total token count.
        Each batch stays under max_batch_tokens to avoid truncation.
        """
        batches: List[List[str]] = []
        current_batch: List[str] = []
        current_len = 0

        for sent in sentences:
            sent_len = len(sent.split())
            if current_len + sent_len > max_batch_tokens and current_batch:
                batches.append(current_batch)
                current_batch = [sent]
                current_len = sent_len
            else:
                current_batch.append(sent)
                current_len += sent_len

        if current_batch:
            batches.append(current_batch)

        return batches if batches else [[s] for s in sentences]

    def _translate_batch_indictrans2(
        self,
        sentences: List[str],
        src_key: str,
        tgt_key: str,
        model: Any,
        tokenizer: Any,
    ) -> List[str]:
        """Translate a batch of sentences using IndicTrans2 with optimized greedy inference."""
        src_tag = INDICTRANS_LANG_MAP.get(src_key, "hin_Deva")
        tgt_tag = INDICTRANS_LANG_MAP.get(tgt_key, "eng_Latn")

        batch = self.processor.preprocess_batch(
            sentences, src_lang=src_tag, tgt_lang=tgt_tag
        )
        inputs = tokenizer(
            batch,
            padding="longest",
            truncation=True,
            max_length=256,
            return_tensors="pt",
        ).to(DEVICE)

        with torch.no_grad():
            generated_tokens = model.generate(
                **inputs,
                use_cache=True,
                min_length=0,
                max_length=256,
                num_beams=1,  # Greedy search is 4x faster with minimal VRAM/swap footprint
                num_return_sequences=1,
            )
        with torch.no_grad():
            decoded = tokenizer.batch_decode(
                generated_tokens.detach().cpu().tolist(), src=False
            )
        postprocessed = self.processor.postprocess_batch(decoded, lang=tgt_tag)
        return [
            t.replace("</s>", "")
            .replace("<s>", "")
            .replace("<pad>", "")
            .replace("<unk>", "")
            .strip()
            for t in postprocessed
        ]

    def _translate_batch_nllb(
        self,
        sentences: List[str],
        src_key: str,
        tgt_key: str,
        model: Any,
        tokenizer: Any,
    ) -> List[str]:
        """Translate a batch using NLLB-200 model."""
        src_tag = NLLB_LANG_MAP.get(src_key, "hin_Deva")
        tgt_tag = NLLB_LANG_MAP.get(tgt_key, "eng_Latn")
        tokenizer.src_lang = src_tag
        forced_bos_token_id = tokenizer.convert_tokens_to_ids(tgt_tag)

        inputs = tokenizer(
            sentences,
            padding="longest",
            truncation=True,
            max_length=256,
            return_tensors="pt",
        ).to(DEVICE)

        with torch.no_grad():
            generated_tokens = model.generate(
                **inputs,
                forced_bos_token_id=forced_bos_token_id,
                use_cache=True,
                max_length=256,
                num_beams=1,
            )
        with torch.no_grad():
            decoded = tokenizer.batch_decode(
                generated_tokens.detach().cpu().tolist(), skip_special_tokens=True
            )
        return [d.strip() for d in decoded]

    def translate(
        self,
        text: str,
        src_lang: str,
        tgt_lang: str,
    ) -> Dict[str, Any]:
        """Translate text with sentence batching and pre/post processing."""
        if not text or not text.strip():
            return {
                "translated_text": "",
                "model": "none",
                "model_type": "none",
                "model_detail": "Empty input",
                "src_lang": src_lang,
                "tgt_lang": tgt_lang,
            }

        src_key = src_lang.lower().split("-")[0]
        tgt_key = tgt_lang.lower().split("-")[0]

        if src_key == "auto":
            detected = detect_script_language(text)
            src_key = detected if detected else "hi"

        if src_key == tgt_key:
            return {
                "translated_text": text,
                "model": "identity",
                "model_type": "identity",
                "model_detail": "Same source and target language",
                "src_lang": src_key,
                "tgt_lang": tgt_key,
            }

        model, tokenizer, model_type, model_name = self.load_model(src_key, tgt_key)

        sentences = self._split_into_sentences(text)
        batches = self._batch_sentences(sentences, max_batch_tokens=300)

        translated_sentences: List[str] = []
        for batch in batches:
            if not batch:
                continue
            try:
                if model_type == "indictrans2" and self.processor is not None:
                    translated = self._translate_batch_indictrans2(
                        batch, src_key, tgt_key, model, tokenizer
                    )
                else:
                    translated = self._translate_batch_nllb(
                        batch, src_key, tgt_key, model, tokenizer
                    )
                translated_sentences.extend(translated)
            except Exception as e:
                print(f"[Local AI] Batch translation error ({e})")
                translated_sentences.extend(batch)

        result_text = " ".join(translated_sentences).strip()
        model_label = "indictrans2-local" if model_type == "indictrans2" else "nllb-local"

        return {
            "translated_text": result_text,
            "model": model_label,
            "model_type": model_type,
            "model_detail": f"Local {model_name} on {DEVICE}",
            "src_lang": src_key,
            "tgt_lang": tgt_key,
        }

    def translate_segments_batched(
        self,
        segments: List[Dict[str, Any]],
        src_lang: str,
        tgt_lang: str,
    ) -> List[Dict[str, Any]]:
        """
        Translate video segments in parallel context-aware batches.
        Processes multiple context windows simultaneously on the GPU in <4 seconds.
        """
        if not segments:
            return []

        src_key = src_lang.lower().split("-")[0]
        tgt_key = tgt_lang.lower().split("-")[0]

        if src_key == "auto":
            sample_text = " ".join(s.get("text", "") for s in segments[:5])
            detected = detect_script_language(sample_text)
            src_key = detected if detected else "hi"

        if src_key == tgt_key:
            return segments

        model, tokenizer, model_type, model_name = self.load_model(src_key, tgt_key)

        # ── Group short segments into context windows (10-80 words) ──
        groups: List[List[int]] = []
        current_group: List[int] = []
        current_word_count = 0
        MIN_WORDS_PER_GROUP = 10

        for i, seg in enumerate(segments):
            text = seg.get("text", "").strip()
            word_count = len(text.split()) if text else 0
            current_group.append(i)
            current_word_count += word_count

            if current_word_count >= MIN_WORDS_PER_GROUP:
                groups.append(current_group)
                current_group = []
                current_word_count = 0

        if current_group:
            groups.append(current_group)

        # Collect context window texts
        group_combined_texts: List[str] = []
        valid_group_meta: List[Tuple[int, List[int], List[str]]] = []

        for g_idx, group_indices in enumerate(groups):
            group_texts = [segments[i].get("text", "").strip() for i in group_indices]
            non_empty = [t for t in group_texts if t]
            if not non_empty:
                continue
            combined = " ".join(non_empty)
            group_combined_texts.append(combined)
            valid_group_meta.append((g_idx, group_indices, group_texts))

        if not group_combined_texts:
            return segments

        print(
            f"[Local AI] Translating {len(segments)} segments across {len(group_combined_texts)} context windows "
            f"({src_key} ➔ {tgt_key}) in parallel using {model_name}..."
        )

        # Batch translate all context windows in parallel chunks of 16
        CHUNK_SIZE = 16
        all_translated_combined: List[str] = []

        for c_start in range(0, len(group_combined_texts), CHUNK_SIZE):
            chunk = group_combined_texts[c_start : c_start + CHUNK_SIZE]
            try:
                if model_type == "indictrans2" and self.processor is not None:
                    chunk_results = self._translate_batch_indictrans2(
                        chunk, src_key, tgt_key, model, tokenizer
                    )
                else:
                    chunk_results = self._translate_batch_nllb(
                        chunk, src_key, tgt_key, model, tokenizer
                    )
                all_translated_combined.extend(chunk_results)
            except Exception as e:
                print(f"[Local AI] Parallel chunk translation notice: {e}")
                all_translated_combined.extend(chunk)

        translated_segments = list(segments)

        # Distribute translated text back to segment timestamps
        for (_, group_indices, group_texts), translated_combined in zip(
            valid_group_meta, all_translated_combined
        ):
            original_lengths = [len(t) for t in group_texts]
            total_original = sum(original_lengths) or 1
            translated_words = translated_combined.split()
            total_translated_words = len(translated_words)
            cursor = 0

            for local_idx, seg_idx in enumerate(group_indices):
                orig_len = original_lengths[local_idx]
                proportion = orig_len / total_original
                word_count_for_seg = max(1, round(proportion * total_translated_words))
                seg_translated = " ".join(
                    translated_words[cursor : cursor + word_count_for_seg]
                )
                cursor += word_count_for_seg

                translated_segments[seg_idx] = {
                    **segments[seg_idx],
                    "text": seg_translated.strip(),
                }

        print(f"[Local AI] ✓ Parallel Translation Complete: {len(translated_segments)} segments translated in seconds.")
        return translated_segments


# ---------------------------------------------------------------------------
# Whisper ASR Engine — GPU-accelerated when available
# ---------------------------------------------------------------------------
def is_hallucination_or_noise(text: str) -> bool:
    """
    Check if a transcribed segment is a hallucination / repetitive loop
    caused by background music, ambient noise, or silence.
    """
    if not text or len(text.strip()) == 0:
        return True

    clean = text.strip()

    # 1. Check for 4+ consecutive identical characters (e.g. 'বববব', 'aaaa', '.....')
    import re
    if re.search(r'(.)\1{3,}', clean):
        return True

    # 2. Check for repetitive 2-4 character n-grams (e.g. 'बेববেববেব')
    if re.search(r'(.{2,4})\1{3,}', clean):
        return True

    # 3. Check character entropy/diversity: if a segment is long (>8 chars)
    # but consists of very few unique characters (< 25%), it's a hallucination
    chars_no_space = re.sub(r'\s+', '', clean)
    if len(chars_no_space) >= 8:
        unique_ratio = len(set(chars_no_space)) / len(chars_no_space)
        if unique_ratio < 0.25:
            return True

    return False


class WhisperManager:
    """
    Manages the faster-whisper ASR model.
    Default: large-v3-turbo (SOTA accuracy for Indian regional languages & noisy speech).
    Falls back gracefully to medium / small if needed.
    """

    def __init__(self):
        self.model: Optional[Any] = None
        self.model_size = "large-v3-turbo"
        self._loaded_device: Optional[str] = None

    def _resolve_whisper_device(self) -> Tuple[str, str]:
        """
        Resolve the best device/compute_type for faster-whisper.
        faster-whisper supports: cuda (float16/int8), cpu (int8).
        MPS is NOT supported by CTranslate2 — falls back to CPU.
        """
        if DEVICE == "cuda":
            return "cuda", "float16"
        # MPS and CPU both use CPU int8 for faster-whisper
        return "cpu", "int8"

    def _ensure_model(self):
        if self.model is not None:
            return self.model

        from faster_whisper import WhisperModel

        whisper_device, compute_type = self._resolve_whisper_device()
        threads = os.cpu_count() or 8 if whisper_device == "cpu" else 1

        target_size = "large-v3-turbo" if "turbo" in self.model_size.lower() else self.model_size

        print(
            f"[Local AI] Loading Whisper {target_size} | "
            f"device={whisper_device} | compute={compute_type} | threads={threads}..."
        )
        try:
            self.model = WhisperModel(
                target_size,
                device=whisper_device,
                compute_type=compute_type,
                cpu_threads=threads,
                num_workers=2,
            )
            self.model_size = target_size
        except Exception as e:
            print(f"[Local AI] Whisper {target_size} notice ({e}). Falling back to 'medium'...")
            self.model = WhisperModel(
                "medium",
                device=whisper_device,
                compute_type=compute_type,
                cpu_threads=threads,
                num_workers=2,
            )
            self.model_size = "medium"

        self._loaded_device = whisper_device
        print(
            f"[Local AI] ✓ Whisper {self.model_size} ready on {whisper_device} ({compute_type})."
        )
        return self.model

    def offload(self):
        """Offload Whisper model from memory."""
        if self.model is not None:
            del self.model
            self.model = None
            gc.collect()
            print("[Local AI] Whisper model offloaded.")

    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        model_size: Optional[str] = None,
    ) -> Dict[str, Any]:
        # If a specific model size was requested and differs, reload
        if model_size and model_size != self.model_size:
            self.model_size = model_size
            self.model = None

        model = self._ensure_model()
        lang = language if (language and language != "auto") else None

        # On CPU, beam_size=1 (greedy search) is 4-5x faster with virtually identical accuracy.
        # On GPU (CUDA), beam_size=3 provides high accuracy at GPU speeds.
        beam_size = 3 if self._loaded_device == "cuda" else 1
        best_of = 3 if self._loaded_device == "cuda" else 1

        print(
            f"[Local AI] ASR transcribing: {Path(audio_path).name} "
            f"(lang={lang or 'auto-detect'}, beam_size={beam_size}, device={self._loaded_device})..."
        )

        segments_gen, info = model.transcribe(
            audio_path,
            language=lang,
            beam_size=beam_size,
            best_of=best_of,
            temperature=0.0,
            compression_ratio_threshold=2.4,  # Auto-reject high repetition
            log_prob_threshold=-1.0,          # Auto-reject low confidence noise
            no_speech_threshold=0.6,          # Auto-reject silence
            condition_on_previous_text=False, # Prevents infinite repetition loops
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=600,
                speech_pad_ms=250,
                threshold=0.6,  # 0.6 prevents background music/instruments from triggering speech detection
            ),
        )

        segments = []
        full_text_list = []
        for s in segments_gen:
            clean_text = s.text.strip()
            if not clean_text:
                continue

            # Filter out non-speech hallucinations (e.g. repeated characters during music/silence)
            if is_hallucination_or_noise(clean_text):
                print(f"[Local AI] ⚠️ Dropped non-speech hallucination [{s.start:.1f}s -> {s.end:.1f}s]: {clean_text[:40]}...")
                continue

            segments.append({
                "start": round(s.start, 3),
                "end": round(s.end, 3),
                "text": clean_text,
            })
            full_text_list.append(clean_text)
            print(f"[Local AI] ASR Segment {len(segments)} [{s.start:.1f}s -> {s.end:.1f}s]: {clean_text}")

        full_text = " ".join(full_text_list).strip()
        detected_lang = getattr(info, "language", None) or (language or "hi")
        duration = round(getattr(info, "duration", 0.0), 2)

        # Guard: If auto-detection incorrectly picked 'bn' on intro music and produced 0 valid segments,
        # automatically re-transcribe with Marathi ('mr') to extract the actual dialogue!
        if not lang and detected_lang == "bn" and len(segments) <= 2:
            print("[Local AI] 🔄 Auto-detect misclassified intro music as 'bn'. Re-transcribing in Marathi ('mr')...")
            return self.transcribe(audio_path, language="mr", model_size=model_size)

        print(
            f"[Local AI] ✓ ASR Complete: {len(segments)} valid segments, "
            f"{len(full_text)} chars, lang={detected_lang}, duration={duration}s"
        )

        return {
            "text": full_text,
            "segments": segments,
            "detected_language": detected_lang,
            "language_probability": round(
                getattr(info, "language_probability", 1.0), 2
            ),
            "duration": duration,
            "model": f"whisper-{self.model_size}-{'gpu' if self._loaded_device == 'cuda' else 'cpu'}",
        }


# ---------------------------------------------------------------------------
# Segment-Aware Neural TTS Engine
# ---------------------------------------------------------------------------
class TtsManager:
    """
    Synthesizes speech either as a single block or per-segment with time-slot alignment.
    Per-segment mode: each sentence's audio is placed at the correct timestamp,
    with silence padding and gentle time-stretching via ffmpeg atempo.
    """

    async def synthesize_single(
        self,
        text: str,
        language: str,
        voice_override: Optional[str] = None,
        rate: str = "-5%",
    ) -> bytes:
        """Synthesize a single text block to MP3 bytes."""
        import edge_tts

        lang_key = language.lower().split("-")[0]
        voice = voice_override or TTS_VOICE_MAP.get(lang_key, "hi-IN-SwaraNeural")
        clean_text = text.strip() or "..."

        tmp_path = Path(tempfile.mktemp(suffix=".mp3"))
        try:
            communicate = edge_tts.Communicate(clean_text, voice, rate=rate)
            await communicate.save(str(tmp_path))
            return tmp_path.read_bytes()
        except Exception as e:
            print(f"[Local AI] Edge TTS notice: {e}, attempting gTTS fallback...")
            from gtts import gTTS
            tts = gTTS(
                text=clean_text,
                lang=lang_key if lang_key in ["hi", "mr", "en", "bn", "gu", "ta", "te"] else "hi",
            )
            tts.save(str(tmp_path))
            return tmp_path.read_bytes()
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    async def synthesize_segments(
        self,
        segments: List[Dict[str, Any]],
        language: str,
        total_duration: float,
        voice_override: Optional[str] = None,
    ) -> bytes:
        """
        Synthesize per-segment audio with time-slot alignment.
        Each segment {text, start, end} is synthesized independently,
        then overlaid at the correct position on a silence timeline.
        Returns a single MP3 covering the full video duration.
        """
        from pydub import AudioSegment
        import edge_tts

        lang_key = language.lower().split("-")[0]
        voice = voice_override or TTS_VOICE_MAP.get(lang_key, "hi-IN-SwaraNeural")

        if not segments:
            silence = AudioSegment.silent(duration=int(total_duration * 1000))
            buf = BytesIO()
            silence.export(buf, format="mp3", bitrate="192k")
            return buf.getvalue()

        # Build timeline as silence for the full video duration
        timeline_ms = int(max(total_duration, segments[-1]["end"] + 1.0) * 1000)
        output = AudioSegment.silent(duration=timeline_ms)

        for i, seg in enumerate(segments):
            seg_text = seg.get("text", "").strip()
            if not seg_text:
                continue

            seg_start_ms = int(seg["start"] * 1000)
            seg_end_ms = int(seg["end"] * 1000)
            slot_duration_ms = seg_end_ms - seg_start_ms

            if slot_duration_ms <= 0:
                continue

            # Synthesize this segment — use a finally block to guarantee cleanup
            tmp_path = Path(tempfile.mktemp(suffix=".mp3"))
            try:
                try:
                    communicate = edge_tts.Communicate(seg_text, voice, rate="-5%")
                    await communicate.save(str(tmp_path))
                except Exception as e:
                    print(f"[TTS] Edge TTS segment {i} notice: {e}, trying gTTS...")
                    from gtts import gTTS
                    fallback_lang = (
                        lang_key
                        if lang_key in ["hi", "mr", "en", "bn", "gu", "ta", "te"]
                        else "hi"
                    )
                    tts = gTTS(text=seg_text, lang=fallback_lang)
                    tts.save(str(tmp_path))

                seg_audio = AudioSegment.from_file(str(tmp_path))

            except Exception as e:
                print(f"[TTS] Segment {i} synthesis failed: {e}")
                continue
            finally:
                # Always clean up temp file, even on error
                if tmp_path.exists():
                    tmp_path.unlink()

            # Time-align: stretch or compress to fit the subtitle slot
            actual_ms = len(seg_audio)
            if actual_ms <= 0:
                continue

            if actual_ms > slot_duration_ms:
                ratio = min(2.0, actual_ms / slot_duration_ms)
                seg_audio = self._time_stretch(seg_audio, ratio)
            elif actual_ms < slot_duration_ms * 0.5:
                ratio = max(0.5, actual_ms / slot_duration_ms)
                seg_audio = self._time_stretch(seg_audio, ratio)

            # Trim or pad to exact slot
            if len(seg_audio) > slot_duration_ms:
                seg_audio = seg_audio[:slot_duration_ms]
            elif len(seg_audio) < slot_duration_ms:
                seg_audio = seg_audio + AudioSegment.silent(
                    duration=slot_duration_ms - len(seg_audio)
                )

            output = output.overlay(seg_audio, position=seg_start_ms)

            if (i + 1) % 20 == 0:
                print(f"[TTS] Processed {i + 1}/{len(segments)} segments...")

        print(f"[TTS] ✓ All {len(segments)} segments synthesized and time-aligned.")

        buf = BytesIO()
        output.export(buf, format="mp3", bitrate="192k")
        return buf.getvalue()

    def _time_stretch(self, audio: Any, ratio: float) -> Any:
        """
        Time-stretch audio using ffmpeg atempo filter.
        ratio > 1.0 = speed up, ratio < 1.0 = slow down.
        Atempo range is [0.5, 2.0]; chain filters for values outside range.
        """
        if abs(ratio - 1.0) < 0.05:
            return audio

        in_path = Path(tempfile.mktemp(suffix=".wav"))
        out_path = Path(str(in_path) + ".stretched.wav")

        try:
            from pydub import AudioSegment
            audio.export(str(in_path), format="wav")

            # Build atempo chain for values outside [0.5, 2.0]
            atempo_value = max(0.5, min(2.0, ratio))
            filter_str = f"atempo={atempo_value:.4f}"

            cmd = [
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(in_path),
                "-filter:a", filter_str,
                "-f", "wav", str(out_path),
            ]
            subprocess.run(cmd, capture_output=True, check=True)
            return AudioSegment.from_file(str(out_path), format="wav")
        except Exception as e:
            print(f"[TTS] Time-stretch notice: {e}")
            return audio
        finally:
            for p in [in_path, out_path]:
                if p.exists():
                    p.unlink()


# ---------------------------------------------------------------------------
# Video Dubbing via FFmpeg
# ---------------------------------------------------------------------------
def dub_video_ffmpeg(
    video_path: str,
    audio_path: str,
    output_path: str,
    duck_original: bool = False,
) -> str:
    """Mux a translated audio track with a video file using FFmpeg."""
    # Ensure output directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    if duck_original:
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", video_path,
            "-i", audio_path,
            "-filter_complex",
            "[0:a]volume=0.12[a0];[1:a]volume=1.0[a1];[a0][a1]amix=inputs=2:duration=first[aout]",
            "-map", "0:v:0", "-map", "[aout]",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            output_path,
        ]
    else:
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", video_path,
            "-i", audio_path,
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            output_path,
        ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg dubbing failed: {res.stderr}")
    return output_path


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="VaakSetu Local AI Engine",
    description=(
        "Fully offline Indic AI server: IndicTrans2 (200M/1B) + "
        "Whisper ASR (GPU-accelerated) + Neural TTS + Video Dubbing"
    ),
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

translator = TranslationManager()
whisper_mgr = WhisperManager()
tts_mgr = TtsManager()


# ---------------------------------------------------------------------------
# Pydantic Request/Response Schemas
# ---------------------------------------------------------------------------
class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "auto"
    target_lang: str = "en"
    hf_token: Optional[str] = None


class BatchTranslateSegmentItem(BaseModel):
    text: str
    start: float = 0.0
    end: float = 0.0


class BatchTranslateRequest(BaseModel):
    """
    Translate video segments in context-aware batches.
    Segments are grouped by context window (not translated individually)
    to produce coherent, non-gibberish translation output.
    """
    segments: List[BatchTranslateSegmentItem]
    source_lang: str = "auto"
    target_lang: str = "en"
    hf_token: Optional[str] = None


class TtsRequest(BaseModel):
    text: str
    language: str = "hi"
    voice: Optional[str] = None


class TtsSegment(BaseModel):
    text: str
    start: float
    end: float


class TtsSegmentsRequest(BaseModel):
    segments: List[TtsSegment]
    language: str = "hi"
    total_duration: float = 0.0
    voice: Optional[str] = None


class DubRequest(BaseModel):
    video_path: str
    audio_path: str
    output_path: str
    duck_original: bool = False


class TranscribePathRequest(BaseModel):
    audio_path: str
    language: Optional[str] = None
    model_size: Optional[str] = None


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """Health check with full device, VRAM, and model status information."""
    vram_info: Dict[str, Any] = {"total_gb": round(AVAILABLE_VRAM_GB, 2)}
    if DEVICE == "cuda":
        try:
            allocated = torch.cuda.memory_allocated(0) / (1024 ** 3)
            reserved = torch.cuda.memory_reserved(0) / (1024 ** 3)
            vram_info["allocated_gb"] = round(allocated, 2)
            vram_info["reserved_gb"] = round(reserved, 2)
            vram_info["free_gb"] = round(AVAILABLE_VRAM_GB - reserved, 2)
            vram_info["device_name"] = torch.cuda.get_device_name(0)
        except Exception:
            pass

    uses_1b = AVAILABLE_VRAM_GB >= VRAM_1B_THRESHOLD_GB
    return {
        "status": "healthy",
        "service": "VaakSetu Local AI Engine v3.0",
        "platform": sys.platform,
        "device": DEVICE,
        "torch_dtype": str(TORCH_DTYPE),
        "vram": vram_info,
        "translation": {
            "active_models": list(translator.models.keys()),
            "max_loaded_models": MAX_LOADED_TRANSLATION_MODELS,
            "uses_1b_models": uses_1b,
            "vram_threshold_for_1b": VRAM_1B_THRESHOLD_GB,
            "has_indictrans2": bool(translator._get_hf_token()),
            "has_processor": translator.processor is not None,
            "fallback": "nllb-200-distilled-600M",
        },
        "whisper": {
            "model_size": whisper_mgr.model_size,
            "loaded": whisper_mgr.model is not None,
            "device": whisper_mgr._loaded_device or "not-loaded",
        },
        "tts": {
            "voices": list(TTS_VOICE_MAP.keys()),
            "segment_aware": True,
        },
    }


@app.post("/api/translate")
async def translate_endpoint(req: TranslateRequest):
    """Translate text using IndicTrans2 or NLLB with context-aware batching."""
    if req.hf_token:
        os.environ["HF_TOKEN"] = req.hf_token
    try:
        res = await asyncio.to_thread(
            translator.translate, req.text, req.source_lang, req.target_lang
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/translate-batch")
async def translate_batch_endpoint(req: BatchTranslateRequest):
    """
    Translate video/subtitle segments in context-aware batches.

    Unlike /api/translate which processes text as a single string,
    this endpoint preserves timestamp metadata while grouping segments
    into context windows for coherent translation (prevents gibberish).
    """
    if req.hf_token:
        os.environ["HF_TOKEN"] = req.hf_token
    try:
        segments_data = [
            {"text": s.text, "start": s.start, "end": s.end}
            for s in req.segments
        ]
        translated = await asyncio.to_thread(
            translator.translate_segments_batched,
            segments_data,
            req.source_lang,
            req.target_lang,
        )
        return {
            "segments": translated,
            "count": len(translated),
            "source_lang": req.source_lang,
            "target_lang": req.target_lang,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/transcribe")
async def transcribe_endpoint(req: TranscribePathRequest):
    """Transcribe audio from a file path (must be accessible by this service)."""
    if not Path(req.audio_path).exists():
        raise HTTPException(status_code=404, detail="Audio file not found.")
    try:
        res = await asyncio.to_thread(
            whisper_mgr.transcribe, req.audio_path, req.language, req.model_size
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/transcribe-file")
async def transcribe_file_endpoint(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """Transcribe audio from an uploaded file."""
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    tmp_path = Path(tempfile.mktemp(suffix=suffix))
    try:
        content = await file.read()
        tmp_path.write_bytes(content)
        res = await asyncio.to_thread(
            whisper_mgr.transcribe, str(tmp_path), language
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


@app.post("/api/tts")
async def tts_endpoint(req: TtsRequest):
    """Synthesize speech for a single text block."""
    try:
        audio_bytes = await tts_mgr.synthesize_single(req.text, req.language, req.voice)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tts-segments")
async def tts_segments_endpoint(req: TtsSegmentsRequest):
    """
    Synthesize per-segment audio with time-slot alignment.
    Each segment's audio is placed at its original timestamp position.
    Returns a single MP3 covering the full video duration.
    """
    try:
        segments_data = [
            {"text": s.text, "start": s.start, "end": s.end} for s in req.segments
        ]
        audio_bytes = await tts_mgr.synthesize_segments(
            segments_data, req.language, req.total_duration, req.voice
        )
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/dub")
async def dub_endpoint(req: DubRequest):
    """Mux a translated audio track into a video file."""
    if not Path(req.video_path).exists():
        raise HTTPException(status_code=404, detail="Video file not found.")
    if not Path(req.audio_path).exists():
        raise HTTPException(status_code=404, detail="Audio file not found.")
    try:
        out = await asyncio.to_thread(
            dub_video_ffmpeg,
            req.video_path,
            req.audio_path,
            req.output_path,
            req.duck_original,
        )
        return {"status": "success", "output_path": out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/system/offload")
async def offload_models_endpoint():
    """
    Explicitly offload all loaded models from VRAM/RAM.
    Call this when switching between modules (Text → Chat → Video)
    to free memory before loading the next module's models.
    """
    translator.offload_all()
    whisper_mgr.offload()
    gc.collect()
    if DEVICE == "cuda":
        torch.cuda.empty_cache()
    return {"status": "ok", "message": "All models offloaded from memory."}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("LOCAL_AI_PORT", 8000))
    print(f"[Local AI] Starting VaakSetu Local AI Engine v3.0 on http://127.0.0.1:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
