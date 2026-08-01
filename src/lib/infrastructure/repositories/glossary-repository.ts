/** Prisma-backed repository for the domain glossary (curated term translations). */

import { db } from "@/lib/db";

export interface GlossaryRecord {
  id: string;
  sourceLang: string;
  targetLang: string;
  source: string;
  target: string;
  category: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const select = {
  id: true,
  sourceLang: true,
  targetLang: true,
  source: true,
  target: true,
  category: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const GlossaryRepository = {
  list: (opts: { sourceLang?: string; targetLang?: string; category?: string; q?: string } = {}) => {
    const where: Record<string, unknown> = {};
    if (opts.sourceLang) where.sourceLang = opts.sourceLang;
    if (opts.targetLang) where.targetLang = opts.targetLang;
    if (opts.category) where.category = opts.category;
    if (opts.q) {
      where.OR = [
        { source: { contains: opts.q } },
        { target: { contains: opts.q } },
        { note: { contains: opts.q } },
      ];
    }
    return db.glossaryEntry.findMany({
      where,
      orderBy: [{ source: "asc" }],
      select,
    });
  },

  create: (data: {
    sourceLang: string;
    targetLang: string;
    source: string;
    target: string;
    category?: string;
    note?: string | null;
  }) => db.glossaryEntry.create({ data, select }),

  update: (id: string, data: Partial<GlossaryRecord>) =>
    db.glossaryEntry.update({ where: { id }, data, select }),

  remove: (id: string) => db.glossaryEntry.delete({ where: { id } }),

  /** Look up all glossary terms for a language pair (used to post-process translations). */
  forPair: (sourceLang: string, targetLang: string) =>
    db.glossaryEntry.findMany({
      where: { sourceLang, targetLang },
      select,
    }),

  count: () => db.glossaryEntry.count(),
};
