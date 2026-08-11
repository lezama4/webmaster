import { describe, expect, it } from "vitest";

import { approveProposal } from "@application/use-cases/approveProposal";
import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";
import {
  FakeMatchingUnitOfWork,
  FakePublicHospitalDirectoryQuery,
  FakeSessionPort,
  InMemoryEventRepository,
  InMemoryProfileRepository,
  InMemoryProposalRepository,
  InMemorySlotRepository,
  SESSION_ABSOLUTE_EXPIRY_MS,
  SESSION_IDLE_EXPIRY_MS,
  SequentialIdGenerator,
} from "./support/fakes";
import { actorFor, anAccount, anOpenSlot, aProposal, aProfile } from "./support/builders";

/**
 * pr2a-M4: the previous fakes did not enforce the session-expiry or
 * unit-of-work atomicity guarantees the real ports/adapters claim, so the
 * (green) unit suite could not evidence them. These tests exercise the
 * FAKES' OWN contract compliance directly — the definitive proof against
 * Postgres remains PR 2b's integration suite (currently DB-gated/skipped in
 * this environment), but the unit suite must no longer be silently
 * over-claiming what it covers.
 */
describe("FakeSessionPort contract (pr2a-M4): absolute expiry, idle expiry, touch", () => {
  it("resolveValid returns the session before either deadline", async () => {
    let now = new Date("2026-07-10T12:00:00Z");
    const clock = { now: () => now };
    const sessions = new FakeSessionPort(clock);
    const session = await sessions.create("account-1");

    now = new Date(session.createdAt.getTime() + 1_000);
    expect(await sessions.resolveValid(session.id)).not.toBeNull();
  });

  it("resolveValid returns null once the ABSOLUTE expiry has elapsed, even if recently touched", async () => {
    let now = new Date("2026-07-10T12:00:00Z");
    const clock = { now: () => now };
    const sessions = new FakeSessionPort(clock);
    const session = await sessions.create("account-1");

    now = new Date(session.createdAt.getTime() + SESSION_ABSOLUTE_EXPIRY_MS - 1_000);
    await sessions.touch(session.id); // resets the IDLE clock only

    now = new Date(session.createdAt.getTime() + SESSION_ABSOLUTE_EXPIRY_MS + 1_000);
    expect(await sessions.resolveValid(session.id)).toBeNull();
  });

  it("resolveValid returns null once the IDLE expiry has elapsed since the last touch", async () => {
    let now = new Date("2026-07-10T12:00:00Z");
    const clock = { now: () => now };
    const sessions = new FakeSessionPort(clock);
    const session = await sessions.create("account-1");

    now = new Date(session.createdAt.getTime() + SESSION_IDLE_EXPIRY_MS + 1_000);
    expect(await sessions.resolveValid(session.id)).toBeNull();
  });

  it("touch resets the idle-expiry clock — a session touched just before its idle deadline stays valid past the original deadline", async () => {
    let now = new Date("2026-07-10T12:00:00Z");
    const clock = { now: () => now };
    const sessions = new FakeSessionPort(clock);
    const session = await sessions.create("account-1");

    now = new Date(session.createdAt.getTime() + SESSION_IDLE_EXPIRY_MS - 1_000);
    await sessions.touch(session.id);

    now = new Date(session.createdAt.getTime() + SESSION_IDLE_EXPIRY_MS + 1_000);
    // Would be expired under the ORIGINAL lastActiveAt, but touch() reset it.
    expect(await sessions.resolveValid(session.id)).not.toBeNull();
  });

  it("resolveValid returns null for an unknown session id", async () => {
    const sessions = new FakeSessionPort();
    expect(await sessions.resolveValid("nonexistent")).toBeNull();
  });
});

describe("FakeMatchingUnitOfWork contract (pr2a-M4): the PERSIST phase rolls back atomically on a mid-write failure", () => {
  it("a failure while persisting the Event (AFTER the Slot and Proposal writes) rolls back the Slot and Proposal writes too — no partial mutation survives", async () => {
    const slots = new InMemorySlotRepository();
    const proposals = new InMemoryProposalRepository();
    class ThrowingEventRepository extends InMemoryEventRepository {
      async save(): Promise<never> {
        throw new Error("simulated Event persistence failure");
      }
    }
    const events = new ThrowingEventRepository();
    const profiles = new InMemoryProfileRepository();
    const matchingUnitOfWork = new FakeMatchingUnitOfWork(slots, proposals, events, profiles);

    const account = anAccount("centre");
    const hospitalProfile = aProfile("centre", "active", { accountId: account.id });
    await profiles.save(hospitalProfile);
    const actor = actorFor(account, hospitalProfile);
    const slot = anOpenSlot({ hospitalProfileId: hospitalProfile.id });
    await slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    const rival = aProposal(slot.id, "artist-2");
    await proposals.save(target);
    await proposals.save(rival);

    await expect(
      approveProposal(
        actor,
        { slotId: slot.id, proposalId: target.id },
        {
          matchingUnitOfWork,
          idGenerator: new SequentialIdGenerator("event"),
          clock: { now: () => new Date("2026-07-10T12:00:00Z") },
        },
      ),
    ).rejects.toThrow("simulated Event persistence failure");

    // NO partial state: the Slot write and the Proposal writes that
    // happened BEFORE the failing Event write were rolled back too.
    expect((await slots.findById(slot.id))?.status).toBe("open");
    expect((await proposals.findById(target.id))?.status).toBe("submitted");
    expect((await proposals.findById(rival.id))?.status).toBe("submitted");
  });
});

/**
 * Phase 1.1 (D9): `FakePublicHospitalDirectoryQuery` honours the
 * `PublicHospitalDirectoryQuery` port contract — `implements` alone gives a
 * compile-time structural guarantee; this test proves the RUNTIME contract
 * too (returns exactly the supplied items, unmodified), mirroring how
 * `FakePublicEventProjectionQuery` is exercised via `listPublishedEvents`.
 */
describe("FakePublicHospitalDirectoryQuery contract (D9): listActive returns exactly what it was constructed with", () => {
  it("returns the supplied items, in order, unmodified", async () => {
    const items: readonly PublicHospitalProjection[] = [
      {
        name: "Hospital Universitario del Mar",
        city: "Valencia",
        postalCode: "46011",
        latitude: 39.4699,
        longitude: -0.3763,
        centreType: "hospital",
        upcomingEventCount: 2,
      },
      {
        name: "Hospital Santa Clara",
        city: "Sevilla",
        postalCode: "41003",
        latitude: 37.3891,
        longitude: -5.9845,
        centreType: "hospital",
        upcomingEventCount: 0,
      },
    ];
    const query = new FakePublicHospitalDirectoryQuery(items);

    expect(await query.listActive()).toEqual(items);
  });

  it("returns an empty array when constructed with none", async () => {
    const query = new FakePublicHospitalDirectoryQuery([]);

    expect(await query.listActive()).toEqual([]);
  });
});
