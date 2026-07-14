import { describe, expect, it } from "vitest";

import { DomainValidationError } from "@domain/errors";
import { ForbiddenError } from "@application/errors";
import { publishSlot } from "@application/use-cases/publishSlot";
import { deactivateProfile } from "@application/use-cases/deactivateProfile";
import {
  fixedClock,
  FakeProfileUnitOfWork,
  FakeSessionPort,
  InMemoryProfileRepository,
  InMemorySlotRepository,
  NOW,
  SequentialIdGenerator,
} from "./support/fakes";
import { actorFor, aProfile, anAccount } from "./support/builders";

function makeDeps() {
  const profiles = new InMemoryProfileRepository();
  const sessions = new FakeSessionPort();
  const slots = new InMemorySlotRepository();
  return {
    profiles,
    sessions,
    profileUnitOfWork: new FakeProfileUnitOfWork(profiles, sessions, sessions, slots),
    slots,
    idGenerator: new SequentialIdGenerator("slot"),
    clock: fixedClock,
  };
}

const slotInput = {
  title: "Acoustic guitar afternoon",
  description: "A relaxed acoustic session for the pediatric ward.",
  scheduledAt: new Date("2026-08-01T17:00:00Z"),
  durationMinutes: 60,
  location: "Ward 3, Room 12",
  audience: "all_ages" as const,
};

async function seedHospital(
  deps: ReturnType<typeof makeDeps>,
  status: "pending" | "active" | "rejected" | "deactivated",
) {
  const account = anAccount("hospital");
  const profile = aProfile("hospital", status, { accountId: account.id });
  await deps.profiles.save(profile);
  return { account, profile, actor: actorFor(account, profile) };
}

describe("publishSlot (active-Hospital gate, atomically persisted through the Profile lock)", () => {
  it("publishes an 'open' Slot owned by the active Hospital", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps, "active");

    const slot = await publishSlot(actor, slotInput, deps);

    expect(slot.status).toBe("open");
    expect(slot.hospitalProfileId).toBe(profile.id);
    expect(slot.audience).toBe("all_ages");
    expect(await deps.slots.findById(slot.id)).not.toBeNull();
  });

  it("denies a pending Hospital (live-status gate)", async () => {
    const deps = makeDeps();
    const { actor } = await seedHospital(deps, "pending");

    await expect(publishSlot(actor, slotInput, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("denies a deactivated Hospital", async () => {
    const deps = makeDeps();
    const { actor } = await seedHospital(deps, "deactivated");

    await expect(publishSlot(actor, slotInput, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("denies a non-Hospital actor (Artist)", async () => {
    const deps = makeDeps();
    const account = anAccount("artist");
    const profile = aProfile("artist", "active", { accountId: account.id });
    await deps.profiles.save(profile);

    await expect(
      publishSlot(actorFor(account, profile), slotInput, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies an Actor whose Account role is 'hospital' but whose live Profile TYPE is 'artist' (pr2a-N1)", async () => {
    const deps = makeDeps();
    const account = anAccount("hospital");
    // Corrupted/imported-data scenario: role says Hospital, live Profile is an Artist Profile.
    const mismatchedProfile = aProfile("artist", "active", { accountId: account.id });
    await deps.profiles.save(mismatchedProfile);

    await expect(
      publishSlot(actorFor(account, mismatchedProfile), slotInput, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("propagates the domain invariant for a past scheduledAt", async () => {
    const deps = makeDeps();
    const { actor } = await seedHospital(deps, "active");

    await expect(
      publishSlot(
        actor,
        { ...slotInput, scheduledAt: new Date(NOW.getTime() - 1000) },
        deps,
      ),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  it("pr2a-M1: denies publishing when deactivation committed before the live check — no Slot is created", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps, "active");
    const admin = actorFor(anAccount("admin"));

    // Starting a Promise first does not establish lock order: deactivation
    // performs an initial Profile lookup before it can enqueue its locked
    // work, while publishSlot immediately acquires the Profile lock. Commit
    // deactivation first so this test proves the intended security property:
    // the use case reads the LIVE Profile in the lock rather than trusting
    // the actor's stale 'active' snapshot.
    await expect(
      deactivateProfile(admin, { profileId: profile.id }, deps),
    ).resolves.toMatchObject({ status: "deactivated" });

    await expect(publishSlot(actor, slotInput, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    // No orphan Slot was created for the now-deactivated Hospital.
    expect((await deps.slots.listOpen()).length).toBe(0);
  });
});
