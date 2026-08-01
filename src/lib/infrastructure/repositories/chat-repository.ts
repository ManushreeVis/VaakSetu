/** Prisma-backed repository for document-chat sessions + messages. */

import { db } from "@/lib/db";

export const ChatRepository = {
  createSession: (data: {
    title: string;
    sourceLang?: string;
    targetLang?: string;
    documentText?: string | null;
    documentName?: string | null;
    documentPath?: string | null;
  }) => db.chatSession.create({ data, include: { messages: { orderBy: { createdAt: "asc" } } } }),

  getSession: (id: string) =>
    db.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),

  listSessions: (limit = 50) =>
    db.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { _count: { select: { messages: true } } },
    }),

  addMessage: (data: {
    sessionId: string;
    role: string;
    content: string;
    audioPath?: string | null;
    replyAudio?: string | null;
  }) => db.chatMessage.create({ data }),

  updateSession: (id: string, data: Record<string, unknown>) =>
    db.chatSession.update({ where: { id }, data }),

  removeSession: (id: string) => db.chatSession.delete({ where: { id } }),

  messages: (sessionId: string) =>
    db.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } }),
};
