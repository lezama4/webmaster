import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  LockedProfileContext,
  LockedProfileWork,
  ProfileUnitOfWork,
} from "@application/ports/ProfileUnitOfWork";
import { profileStatusToPrisma, toDomainProfile, type ProfileRow } from "./mappers";
import { createPrismaSessionPort } from "../../auth/session";

/** Test-only instrumentation, mirrors `MatchingUnitOfWorkHooks` (not part of the port contract). */
export interface ProfileUnitOfWorkHooks {
  readonly afterLock?: (accountId: string) => Promise<void> | void;
}

/**
 * Lock-first `ProfileUnitOfWork` (ADR D7/D8, M3 pr2-review — mirrors
 * `PrismaMatchingUnitOfWork`). In ONE transaction: (1) `SELECT ... FOR
 * UPDATE` on the Account row FIRST (the Profile may legitimately not exist
 * yet — Admin/Patient accounts, D2 — so the lock target is the Account,
 * which always exists for a caller-supplied `accountId`); (2) load the live
 * Profile inside that lock; (3) invoke `work` with a transaction-scoped
 * context whose `sessions` port commits atomically with any Profile-status
 * transition; (4) the transaction commits (or rolls back) as one unit.
 */
export class PrismaProfileUnitOfWork implements ProfileUnitOfWork {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hooks: ProfileUnitOfWorkHooks = {},
  ) {}

  async withLockedProfile<T>(
    accountId: string,
    work: LockedProfileWork<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        // (1) Lock the Account row FIRST — before any decision-informing read.
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "accounts" WHERE "id" = ${accountId} FOR UPDATE`,
        );

        // (2) Load the live Profile INSIDE the lock (null is valid — D2).
        const profileRows = await tx.$queryRaw<ProfileRow[]>(
          Prisma.sql`SELECT * FROM "profiles" WHERE "accountId" = ${accountId}`,
        );
        const profileRow = profileRows[0] ?? null;
        const profile = profileRow ? toDomainProfile(profileRow) : null;

        await this.hooks.afterLock?.(accountId);

        const ctx: LockedProfileContext = {
          profile,
          saveProfile: async (updated) => {
            await tx.profile.update({
              where: { id: updated.id },
              data: {
                status: profileStatusToPrisma(updated.status),
                reviewRequestedAt: updated.reviewRequestedAt ?? null,
              },
            });
          },
          sessions: createPrismaSessionPort(tx),
        };

        // (3)+(4) `work` transitions status / issues-or-revokes sessions;
        // everything it does through `ctx` commits atomically with this
        // transaction.
        return work(ctx);
      },
      { timeout: 15_000, maxWait: 15_000 },
    );
  }
}
