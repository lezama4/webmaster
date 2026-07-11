import { describe, expect, it } from "vitest";
import { getTestPrismaClient, isDatabaseAvailable } from "./support/db";

/**
 * Task 4.5 (B1 pr2-review — BLOCKER): asserts both partial unique indexes
 * on "proposals" exist with their EXACT predicates after migration —
 * catching a silent identifier mismatch (e.g. snake_case columns or
 * lowercase enum literals) before application code is built on top of it.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("partial unique index catalog (4.5, B1)", () => {
  it("has proposals_accepted_per_slot with the ACCEPTED predicate", async () => {
    const client = getTestPrismaClient();
    const rows = await client.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'proposals' AND indexname = 'proposals_accepted_per_slot'
    `;
    expect(rows).toHaveLength(1);
    const def = rows[0]!.indexdef;
    expect(def).toContain('"slotId"');
    expect(def).toContain(`'ACCEPTED'::"ProposalStatus"`);
  });

  it("has proposals_submitted_per_slot_artist with the SUBMITTED predicate", async () => {
    const client = getTestPrismaClient();
    const rows = await client.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'proposals' AND indexname = 'proposals_submitted_per_slot_artist'
    `;
    expect(rows).toHaveLength(1);
    const def = rows[0]!.indexdef;
    expect(def).toContain('"slotId"');
    expect(def).toContain('"artistProfileId"');
    expect(def).toContain(`'SUBMITTED'::"ProposalStatus"`);
  });
});
