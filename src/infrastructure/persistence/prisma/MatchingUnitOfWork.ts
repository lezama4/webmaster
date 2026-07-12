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
  toDomainProposal,
  toDomainSlot,
  type ProposalRow,
  type SlotRow,
} from "./mappers";

/**
 * Test-only instrumentation. Production callers never pass hooks — the
 * default is a no-op — but integration tests use `afterLock` to force a
 * deterministic interleaving between two concurrent transactions targeting
 * the same Slot row (barrier-based race tests, tasks 4.10-4.17). This is
 * NOT part of the `MatchingUnitOfWork` port contract; it is an
 * implementation detail of this one adapter.
 */
export interface MatchingUnitOfWorkHooks {
  /** Awaited AFTER the row lock is acquired and the live Slot+Proposal set is loaded, but BEFORE `work` runs and BEFORE the mutation is persisted. */
  readonly afterLock?: (slotId: string) => Promise<void> | void;
}

const PROPOSAL_UNIQUE_VIOLATION = "P2002";

/**
 * Lock-first `MatchingUnitOfWork` (ADR D4, B2/M1 pr2-review). In ONE
 * transaction: (1) `SELECT ... FOR UPDATE` on the Slot row FIRST — before
 * any decision-informing read; (2) load the live Slot + full Proposal set
 * INSIDE that lock; (3) invoke `work` with the locked, live data; (4)
 * persist whatever `work` returns before commit. A missing Slot rejects
 * with `NotFoundError`. A guard failure inside `work` (thrown
 * synchronously) aborts the transaction — nothing is persisted. A partial-
 * unique-index violation that slips past the application-layer duplicate
 * guard (belt-and-braces, B1) is translated to `ConflictError`, never a raw
 * Postgres error.
 */
export class PrismaMatchingUnitOfWork implements MatchingUnitOfWork {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hooks: MatchingUnitOfWorkHooks = {},
  ) {}

  async withLockedSlot<T>(
    slotId: string,
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

        await this.hooks.afterLock?.(slotId);

        // (3) Invoke the decision callback on the LOCKED, live snapshot.
        // `work` MAY be async (pr2a-M1 — the application layer now nests a
        // live Profile-status recheck via `ProfileUnitOfWork` inside this
        // very callback), so it MUST be awaited here.
        const outcome = await work(lockedSlot, proposals);

        // (4) Persist the returned mutation, still inside the same
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
