/**
 * GlossaryService — manages domain terminology and applies it to translations.
 *
 * Glossary entries enforce consistent translations of proper nouns, technical
 * terms, and programme names (e.g. "drip irrigation" must always become
 * "ठिबक सिंचन", never a paraphrase). After the translation engine runs, the
 * service post-processes the output to replace any term that the glossary
 * pins to a specific translation.
 */

import { GlossaryRepository } from "@/lib/infrastructure/repositories/glossary-repository";
import { JobRepository } from "@/lib/infrastructure/repositories/job-repository";

export interface GlossaryEntryInput {
  sourceLang: string;
  targetLang: string;
  source: string;
  target: string;
  category?: string;
  note?: string | null;
}

export interface AppliedGlossary {
  matched: { source: string; expected: string; applied: boolean }[];
  changed: boolean;
}

/** Escape a string for use in a RegExp (handles Devanagari + Latin). */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Post-process a translation: for each glossary source term that appears in
 * the source text, ensure the approved target appears in the translation.
 *
 * Strategy (safe for cross-script):
 * 1. If the approved target is already present → no change, mark matched.
 * 2. If the source term itself appears in the translation (model left it
 *    untranslated) → replace it with the approved target.
 * 3. Otherwise → append the glossary term as a parenthetical note on the
 *    first occurrence, so the user sees the approved translation without
 *    corrupting the model's output.
 */
export const GlossaryService = {
  list: GlossaryRepository.list,
  create: GlossaryRepository.create,
  update: GlossaryRepository.update,
  remove: GlossaryRepository.remove,
  count: GlossaryRepository.count,

  async applyToTranslation(opts: {
    text: string;
    sourceText: string;
    sourceLang: string;
    targetLang: string;
  }): Promise<{ text: string; glossary: AppliedGlossary }> {
    const entries = await GlossaryRepository.forPair(opts.sourceLang, opts.targetLang);
    if (!entries.length) {
      return { text: opts.text, glossary: { matched: [], changed: false } };
    }

    let result = opts.text;
    let changed = false;
    const matched: AppliedGlossary["matched"] = [];
    const sourceLower = opts.sourceText.toLowerCase();

    for (const entry of entries) {
      const termLower = entry.source.toLowerCase();
      // Only act if the source term appears in the source text.
      if (!sourceLower.includes(termLower)) continue;

      const alreadyPresent = result.includes(entry.target);
      if (alreadyPresent) {
        matched.push({ source: entry.source, expected: entry.target, applied: false });
        continue;
      }

      // Try replacing the untranslated source term in the output.
      const sourcePattern = new RegExp(escapeRegExp(entry.source), "gi");
      if (sourcePattern.test(result)) {
        result = result.replace(sourcePattern, entry.target);
        changed = true;
        matched.push({ source: entry.source, expected: entry.target, applied: true });
      } else {
        // Can't locate the term in the output — append a clarifying note.
        const note = ` (${entry.source}: ${entry.target})`;
        // Append after the first sentence end, or at the end.
        const sentenceEnd = result.search(/[।.!?]/);
        if (sentenceEnd >= 0 && sentenceEnd < result.length - 1) {
          result = result.slice(0, sentenceEnd + 1) + note + result.slice(sentenceEnd + 1);
        } else {
          result = result + note;
        }
        changed = true;
        matched.push({ source: entry.source, expected: entry.target, applied: true });
      }
    }

    return { text: result, glossary: { matched, changed } };
  },

  /**
   * Mine translation history to suggest new glossary entries.
   *
   * For each completed text-translation job (sourceLang→targetLang), extract
   * short source phrases (2-5 words) and pair them with the matching segment
   * of the target text. Filter out phrases already in the glossary, then
   * rank by frequency across jobs. Returns the top N suggestions.
   */
  async suggestFromHistory(opts: {
    sourceLang: string;
    targetLang: string;
    limit?: number;
  }): Promise<{ source: string; target: string; frequency: number }[]> {
    const { sourceLang, targetLang, limit = 12 } = opts;

    // Fetch completed text jobs for this language pair.
    const jobs = await JobRepository.list({
      kind: "text",
      status: "completed",
      limit: 200,
    });

    const existing = await GlossaryRepository.forPair(sourceLang, targetLang);
    const existingSources = new Set(existing.map((e) => e.source.toLowerCase()));

    // Build a frequency map of source-phrase → { target, count }.
    const candidates = new Map<string, { target: string; count: number }>();

    for (const job of jobs) {
      if (job.sourceLang !== sourceLang || job.targetLang !== targetLang) continue;
      if (!job.inputText || !job.outputText) continue;

      // Extract short phrases (2-5 words) from the source text.
      const phrases = extractPhrases(job.inputText);
      for (const phrase of phrases) {
        const key = phrase.toLowerCase();
        if (existingSources.has(key)) continue;
        if (key.length < 4) continue;

        // Try to find a corresponding target segment.
        const target = findCorrespondingTarget(phrase, job.inputText, job.outputText);
        if (!target || target.length < 2) continue;

        const prev = candidates.get(key);
        if (prev) {
          prev.count += 1;
        } else {
          candidates.set(key, { target, count: 1 });
        }
      }
    }

    // Rank by frequency (desc), then alphabetically.
    return Array.from(candidates.entries())
      .map(([source, { target, count }]) => ({ source, target, frequency: count }))
      .sort((a, b) => b.frequency - a.frequency || a.source.localeCompare(b.source))
      .slice(0, limit);
  },
};

/** Extract candidate phrases (2-5 words) from text, filtering stop words. */
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
  "from", "as", "into", "through", "during", "before", "after", "above",
  "below", "up", "down", "this", "that", "these", "those", "it", "its",
]);

const extractPhrases = (text: string): string[] => {
  // Split into sentences, then into word sequences.
  const sentences = text.split(/[।.!?;]\s*/);
  const phrases: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).filter((w) => w.length > 1);
    // Generate 2-5 word sliding windows.
    for (let len = 2; len <= 5; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const chunk = words.slice(i, i + len);
        // Skip if the phrase starts or ends with a stop word.
        if (STOP_WORDS.has(chunk[0].toLowerCase()) || STOP_WORDS.has(chunk[chunk.length - 1].toLowerCase())) continue;
        const phrase = chunk.join(" ").replace(/[.,;:!?]$/, "");
        if (phrase.length >= 8 && phrase.length <= 50) phrases.push(phrase);
      }
    }
  }
  return phrases;
};

/**
 * Heuristic: find the target-text segment corresponding to a source phrase.
 * Since we don't have word alignments, we approximate by returning the
 * target sentence at the same position as the source phrase's sentence.
 */
const findCorrespondingTarget = (phrase: string, sourceText: string, targetText: string): string => {
  const sourceSentences = sourceText.split(/[।.!?;]\s*/);
  const targetSentences = targetText.split(/[।.!?;]\s*/);
  const idx = sourceSentences.findIndex((s) => s.includes(phrase));
  if (idx < 0 || idx >= targetSentences.length) return "";
  return targetSentences[idx].trim();
};
