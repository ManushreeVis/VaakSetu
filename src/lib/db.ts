import { PrismaClient } from '@prisma/client';
import path from 'path';

const getDatabaseUrl = (): string => {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && envUrl.startsWith('file:')) {
    const rawPath = envUrl.replace(/^file:/, '');
    if (path.isAbsolute(rawPath)) {
      return envUrl;
    }
    // Convert relative path to absolute path relative to process.cwd()
    return `file:${path.resolve(process.cwd(), rawPath)}`;
  }
  return `file:${path.resolve(process.cwd(), 'db/custom.db')}`;
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const dbUrl = getDatabaseUrl();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

export const prisma = db;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}