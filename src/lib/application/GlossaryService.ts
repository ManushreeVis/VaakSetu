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
};
