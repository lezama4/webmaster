import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

/**
 * Either a root client or a transaction-scoped client. Repositories accept
 * both so the same adapter code runs standalone AND inside the lock-first
 * unit-of-work transactions (ADR D4/D7).
 */
export type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export interface CreatePrismaClientOptions {
  /** Overrides `DATABASE_URL` (integration tests point at isolated schemas). */
  readonly databaseUrl?: string;
}

export function createPrismaClient(
  options: CreatePrismaClientOptions = {},
): PrismaClient {
  return new PrismaClient(
    options.databaseUrl ? { datasourceUrl: options.databaseUrl } : undefined,
  );
}
