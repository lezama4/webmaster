import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  LockedSlotWork,
  MatchingUnitOfWork,
} from "@application/ports/MatchingUnitOfWork";
import { ConflictError, NotFoundError } from "@application/errors";
import {
  eventStatusToPrisma,
  proposalStatusToPrisma,
  slotStatusToPrisma,
  toDomainProfile,
  toDomainProposal,
  toDomainSlot,
  type ProfileRow,
  type ProposalRow,
  type SlotRow,
} from "./mappers";

/**
 * Test-only instrumentation. Production callers never pass hooks — the
 * default is a no-op — but integration tests use `afterLock` to force a
 * deterministic interleaving between two concurrent transactions targeting
 * the same Slot row (barrier-based race tests, tasks 4.10-4.17, and the
 * Slot-vs-deactivation race, recheck-pr2a-verify-M2). This is NOT part of
 * the `MatchingUnitOfWork` port contract; it is an implementation detail of
 * this one adapter.
 */
export interface MatchingUnitOfWorkHooks {
  /** Awaited AFTER the Slot row lock, the Account row lock, and the live Slot+Proposal+Profile reads are all done, but BEFORE `work` runs and BEFORE the mutation is persisted. */
  readonly afterLock?: (slotId: string) => Promise<void> | void;
}

const PROPOSAL_UNIQUE_VIOLATION = "P2002";

/**
 * Lock-first, single-transaction `MatchingUnitOfWork` (ADR D4, B2/M1
 * pr2-review, unified per recheck-pr2a-verify-M2). In ONE transaction:
 * (1) `SELECT ... FOR UPDATE` on the Slot row FIRST — before any
 * decision-informing read; (2) load the live Slot + full Proposal set
 * INSIDE that lock; (3) `SELECT ... FOR UPDATE` on the actor's Account row
 * — global lock order Slot-then-Account, documented on the port — and load
 * the actor's live Profile inside the SAME transaction; (4) invoke `work`
 * with the locked, live Slot/Proposal/Profile data; (5) persist whatever
 * `work` returns before commit. A missing Slot rejects with
 * `NotFoundError`. A guard failure inside `work` (thrown synchronously)
 * aborts the transaction — nothing is persisted, and the Account lock is
 * released on rollback along with the Slot lock. A partial-unique-index
 * violation that slips past the application-layer duplicate guard
 * (belt-and-braces, B1) is translated to `ConflictError`, never a raw
 * Postgres error.
 *
 * Because the Account lock and Profile read happen in the SAME transaction
 * that later persists the Slot mutation, a concurrent Admin deactivation
 * targeting the same Account cannot commit in between: it blocks on the
 * Account row lock until this transaction commits (or rolls back).
 */
export class PrismaMatchingUnitOfWork implements MatchingUnitOfWork {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hooks: MatchingUnitOfWorkHooks = {},
  ) {}

  async withLockedSlot<T>(
    slotId: string,
    actorAccountId: string,
    work: LockedSlotWork<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        // (1) Lock the Slot row FIRST — before any decision-informing read.
        const lockedRows = await tx.$queryRaw<SlotRow[]>(
          Prisma.sql`SELECT * FROM "slots" WHERE "id" = ${slotId} FOR UPDATE`,
        );
        const slotRow = lockedRows[0];
        if (!slotRow) {
          throw new NotFoundError(`Slot '${slotId}' does not exist`);
        }

        // (2) Load the live Slot + COMPLETE Proposal set INSIDE the lock.
        const proposalRows = await tx.$queryRaw<ProposalRow[]>(
          Prisma.sql`SELECT * FROM "proposals" WHERE "slotId" = ${slotId}`,
        );
        const lockedSlot = toDomainSlot(slotRow);
        const proposals = proposalRows.map(toDomainProposal);

        // (3) Lock the actor's Account SECOND — global lock order documented
        // on the port (Slot first, then Account) — and load its live
        // Profile, still inside THIS SAME transaction (recheck-pr2a-
        // verify-M2): authorization and persistence now commit atomically.
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "accounts" WHERE "id" = ${actorAccountId} FOR UPDATE`,
        );
        const profileRows = await tx.$queryRaw<ProfileRow[]>(
          Prisma.sql`SELECT * FROM "profiles" WHERE "accountId" = ${actorAccountId}`,
        );
        const profileRow = profileRows[0] ?? null;
        const actorProfile = profileRow ? toDomainProfile(profileRow) : null;

        await this.hooks.afterLock?.(slotId);

        // (4) Invoke the decision callback on the LOCKED, live snapshot.
        // `work` MAY be async, so it MUST be awaited here.
        const outcome = await work(lockedSlot, proposals, actorProfile);

        // (5) Persist the returned mutation, still inside the same
        // transaction, before commit.
        try {
          if (outcome.mutation.slot) {
            const s = outcome.mutation.slot;
            await tx.slot.update({
              where: { id: s.id },
              data: { status: slotStatusToPrisma(s.status) },
            });
          }

          for (const p of outcome.mutation.proposals ?? []) {
            await tx.proposal.upsert({
              where: { id: p.id },
              create: {
                id: p.id,
                slotId: p.slotId,
                artistProfileId: p.artistProfileId,
                message: p.message,
                status: proposalStatusToPrisma(p.status),
              },
              update: { status: proposalStatusToPrisma(p.status) },
            });
          }

          if (outcome.mutation.event) {
            const e = outcome.mutation.event;
            await tx.event.create({
              data: {
                id: e.id,
                slotId: e.slotId,
                proposalId: e.proposalId,
                title: e.title,
                status: eventStatusToPrisma(e.status),
              },
            });
          }
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === PROPOSAL_UNIQUE_VIOLATION
          ) {
            // Belt-and-braces (B1): the partial unique indexes on
            // "proposals" caught a race the application-layer guard missed.
            throw new ConflictError(
              `Slot '${slotId}' mutation violates a Proposal uniqueness invariant`,
            );
          }
          throw error;
        }

        return outcome.result;
      },
      // Row-lock waits can legitimately exceed Prisma's 5s default timeout
      // under the race-test matrix's deliberately serialized transactions.
      { timeout: 15_000, maxWait: 15_000 },
    );
  }
}
