import { PrismaClient } from './generated/prisma/index.js';
import type { Prisma } from './generated/prisma/index.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function assertDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Create a .env.local file (e.g. at the repository root or apps/meeting-app/.env.local) with a DATABASE_URL before importing @elkdonis/db.'
    );
  }
}

assertDatabaseUrl();

const createPrismaClient = (): PrismaClient => {
  const logConfig: Prisma.LogLevel[] | undefined =
    process.env.NODE_ENV === 'development' ? ['query'] : undefined;

  return new PrismaClient({
    log: logConfig,
  });
};

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export type PrismaClientType = typeof prisma;
