import { describe, expect, it } from "vitest";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import { createArtistProfile, createHospitalProfile, createOpenSlot } from "./support/fixtures";

/**
 * Task 4.5 (B1 pr2-review — BLOCKER). pr2b-N1 strengthening: the previous
 * version only asserted `indexdef` CONTAINS selected fragments, which could
 * pass for a non-unique or non-partial index whose definition happened to
 * mention the same column/predicate text. This version asserts the FULL
 * shape — `CREATE UNIQUE INDEX`, the exact key column list and order, and
 * that the predicate clause is present and partial (a `WHERE` clause, not
 * merely a substring match) — plus keeps the behavioural duplicate-insert
 * test as the final enforcement proof.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("partial unique index catalog (4.5, B1, pr2b-N1)", () => {
  it("proposals_accepted_per_slot is a UNIQUE, partial index on (slotId) WHERE status = ACCEPTED", async () => {
    const client = getTestPrismaClient();
    const rows = await client.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'proposals' AND indexname = 'proposals_accepted_per_slot'
    `;
    expect(rows).toHaveLength(1);
    const def = rows[0]!.indexdef;

    expect(def.startsWith("CREATE UNIQUE INDEX")).toBe(true);
    expect(def).toMatch(/ON\s+(?:\w+\.)?"?proposals"?\s/); // target table, schema-qualification tolerant
    // Exact key list and order — one column only, no extras.
    expect(def).toMatch(/\(\s*"slotId"\s*\)/);
    expect(def).not.toMatch(/"artistProfileId"/);
    // Partial: a WHERE clause carrying the exact predicate, not just the
    // literal text appearing somewhere unrelated in the definition.
    expect(def).toMatch(/WHERE\s*\(?\s*"status"\s*=\s*'ACCEPTED'::"ProposalStatus"\s*\)?\s*$/);
  });

  it("proposals_submitted_per_slot_artist is a UNIQUE, partial index on (slotId, artistProfileId) WHERE status = SUBMITTED", async () => {
    const client = getTestPrismaClient();
    const rows = await client.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'proposals' AND indexname = 'proposals_submitted_per_slot_artist'
    `;
    expect(rows).toHaveLength(1);
    const def = rows[0]!.indexdef;

    expect(def.startsWith("CREATE UNIQUE INDEX")).toBe(true);
    // Exact key list AND order — slotId first, artistProfileId second.
    expect(def).toMatch(/\(\s*"slotId",\s*"artistProfileId"\s*\)/);
    expect(def).toMatch(/WHERE\s*\(?\s*"status"\s*=\s*'SUBMITTED'::"ProposalStatus"\s*\)?\s*$/);
  });

  it("queries pg_index directly to confirm indisunique and a partial predicate (indpred IS NOT NULL)", async () => {
    const client = getTestPrismaClient();
    const rows = await client.$queryRaw<
      { indexname: string; indisunique: boolean; haspredicate: boolean }[]
    >`
      SELECT
        c2.relname AS indexname,
        i.indisunique,
        (i.indpred IS NOT NULL) AS haspredicate
      FROM pg_index i
      JOIN pg_class c2 ON c2.oid = i.indexrelid
      WHERE c2.relname IN ('proposals_accepted_per_slot', 'proposals_submitted_per_slot_artist')
    `;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.indisunique).toBe(true);
      expect(row.haspredicate).toBe(true);
    }
  });

  it("behavioural proof: a duplicate ACCEPTED Proposal for the same Slot is rejected at the DB level", async () => {
    const client = getTestPrismaClient();
    await resetDatabase(client);
    const { profile: hospital } = await createHospitalProfile(client);
    const { profile: clara } = await createArtistProfile(client, { name: "Clara" });
    const { profile: mateo } = await createArtistProfile(client, { name: "Mateo" });
    const slot = await createOpenSlot(client, hospital.id);

    await client.proposal.create({
      data: {
        slotId: slot.id,
        artistProfileId: clara.id,
        message: "First",
        status: "ACCEPTED",
      },
    });

    await expect(
      client.proposal.create({
        data: {
          slotId: slot.id,
          artistProfileId: mateo.id,
          message: "Second",
          status: "ACCEPTED",
        },
      }),
    ).rejects.toThrow();
  });

  it("behavioural proof: a duplicate SUBMITTED Proposal by the SAME Artist for the same Slot is rejected at the DB level", async () => {
    const client = getTestPrismaClient();
    await resetDatabase(client);
    const { profile: hospital } = await createHospitalProfile(client);
    const { profile: clara } = await createArtistProfile(client, { name: "Clara" });
    const slot = await createOpenSlot(client, hospital.id);

    await client.proposal.create({
      data: {
        slotId: slot.id,
        artistProfileId: clara.id,
        message: "First",
        status: "SUBMITTED",
      },
    });

    await expect(
      client.proposal.create({
        data: {
          slotId: slot.id,
          artistProfileId: clara.id,
          message: "Second",
          status: "SUBMITTED",
        },
      }),
    ).rejects.toThrow();
  });
});
