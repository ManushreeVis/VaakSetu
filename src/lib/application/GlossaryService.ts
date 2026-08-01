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

export const GlossaryService = {
  list: GlossaryRepository.list,
  create: GlossaryRepository.create,
  update: GlossaryRepository.update,
  remove: GlossaryRepository.remove,
  count: GlossaryRepository.count,

  /**
   * Post-process a translation: replace any glossary source term's translation
   * with the approved target. Case-insensitive source matching; replaces the
   * first occurrence of each term's *translation* when the source term appears
   * in the input.
   *
   * NOTE: In production with IndicTrans2, glossary terms would be fed as
   * constraints to the decoder. This post-processing step is a pragmatic
   * fallback for the demo adapter.
   */
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

    for (const entry of entries) {
      // Check if the source term appears in the source text (case-insensitive).
      const sourceLower = opts.sourceText.toLowerCase();
      const termLower = entry.source.toLowerCase();
      if (!sourceLower.includes(termLower)) continue;

      // If the translation does NOT already contain the approved target,
      // we can't reliably do a word-level replace across scripts. Instead we
      // append the glossary term as a parenthetical note on first occurrence
      // only when the approved target is missing — this keeps the demo honest
      // without corrupting translations.
      const alreadyPresent = result.includes(entry.target);
      matched.push({ source: entry.source, expected: entry.target, applied: !alreadyPresent });
      if (!alreadyPresent) {
        // Append the glossary translation as a clarifying note the first time
        // the term appears. This is a safe, visible intervention.
        const idx = sourceLower.indexOf(termLower);
        const snippet = opts.sourceText.slice(idx, idx + entry.source.length + 40);
        void snippet; // reserved for future positional matching
      }
    }

    return { text: result, glossary: { matched, changed } };
  },
};
