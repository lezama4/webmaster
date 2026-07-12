import { describe, expect, it } from "vitest";

import { ConflictError, ForbiddenError } from "@application/errors";
import { closeSlot } from "@application/use-cases/closeSlot";
import { approveProposal } from "@application/use-cases/approveProposal";
import { deactivateProfile } from "@application/use-cases/deactivateProfile";
import {
  fixedClock,
  FakeMatchingUnitOfWork,
  FakeProfileUnitOfWork,
  FakeSessionPort,
  InMemoryEventRepository,
  InMemoryProfileRepository,
  InMemoryProposalRepository,
  InMemorySlotRepository,
  SequentialIdGenerator,
} from "./support/fakes";
import { actorFor, anAccount, anOpenSlot, aProposal, aProfile } from "./support/builders";

function makeDeps() {
  const slots = new InMemorySlotRepository();
  const proposals = new InMemoryProposalRepository();
  const events = new InMemoryEventRepository();
  const profiles = new InMemoryProfileRepository();
  const sessions = new FakeSessionPort();
  return {
    profiles,
    sessions,
    slots,
    proposals,
    matchingUnitOfWork: new FakeMatchingUnitOfWork(slots, proposals, events),
    profileUnitOfWork: new FakeProfileUnitOfWork(profiles, sessions),
    idGenerator: new SequentialIdGenerator("event"),
    clock: fixedClock,
  };
}

async function seedHospital(
  deps: ReturnType<typeof makeDeps>,
  status: "pending" | "active" | "rejected" | "deactivated" = "active",
) {
  const account = anAccount("hospital");
  const profile = aProfile("hospital", status, { accountId: account.id });
  await deps.profiles.save(profile);
  return { profile, actor: actorFor(account, profile) };
}

describe("closeSlot (owner-Hospital-only, cascades reject, lock-first, B2, pr2a-M1 live-checked inside the Slot lock)", () => {
  it("closes an 'open' Slot with no Proposals", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);

    const outcome = await closeSlot(actor, { slotId: slot.id }, deps);

    expect(outcome.slot.status).toBe("closed");
    expect(outcome.rejectedProposals).toHaveLength(0);
    expect((await deps.slots.findById(slot.id))?.status).toBe("closed");
  });

  it("closes an 'open' Slot and cascade-rejects every 'submitted' Proposal", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const p1 = aProposal(slot.id, "artist-1");
    const p2 = aProposal(slot.id, "artist-2");
    await deps.proposals.save(p1);
    await deps.proposals.save(p2);

    const outcome = await closeSlot(actor, { slotId: slot.id }, deps);

    expect(outcome.slot.status).toBe("closed");
    expect(outcome.rejectedProposals).toHaveLength(2);
    expect((await deps.proposals.findById(p1.id))?.status).toBe("rejected");
    expect((await deps.proposals.findById(p2.id))?.status).toBe("rejected");
  });

  it("locks the Slot FIRST before deciding (D4/B2)", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);

    await closeSlot(actor, { slotId: slot.id }, deps);

    expect(deps.matchingUnitOfWork.lockLog).toEqual([slot.id]);
  });

  it("denies a non-owning Hospital (403)", async () => {
    const deps = makeDeps();
    const { actor } = await seedHospital(deps);
    const other = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: other.profile.id });
    await deps.slots.save(slot);

    await expect(closeSlot(actor, { slotId: slot.id }, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("denies a non-Hospital actor (Admin)", async () => {
    const deps = makeDeps();
    const admin = actorFor(anAccount("admin"));
    const { profile } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);

    await expect(closeSlot(admin, { slotId: slot.id }, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("denies closing an already non-open (filled) Slot with ConflictError", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const p1 = aProposal(slot.id, "artist-1");
    await deps.proposals.save(p1);
    await approveProposal(actor, { slotId: slot.id, proposalId: p1.id }, deps);

    await expect(closeSlot(actor, { slotId: slot.id }, deps)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("denies an Actor whose Account role is 'hospital' but whose live Profile TYPE is 'artist' (pr2a-N1)", async () => {
    const deps = makeDeps();
    const account = anAccount("hospital");
    const mismatchedProfile = aProfile("artist", "active", { accountId: account.id });
    await deps.profiles.save(mismatchedProfile);
    const slot = anOpenSlot({ hospitalProfileId: mismatchedProfile.id });
    await deps.slots.save(slot);

    await expect(
      closeSlot(actorFor(account, mismatchedProfile), { slotId: slot.id }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("pr2a-M1: denies closing when the Hospital's Profile was deactivated between the initial dispatch and the lock — no cascade is committed", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const p1 = aProposal(slot.id, "artist-1");
    await deps.proposals.save(p1);
    const admin = actorFor(anAccount("admin"));

    const deactivation = deactivateProfile(admin, { profileId: profile.id }, deps);
    const closeAttempt = closeSlot(actor, { slotId: slot.id }, deps);

    await expect(deactivation).resolves.toMatchObject({ status: "deactivated" });
    await expect(closeAttempt).rejects.toBeInstanceOf(ForbiddenError);

    expect((await deps.slots.findById(slot.id))?.status).toBe("open");
    expect((await deps.proposals.findById(p1.id))?.status).toBe("submitted");
  });

  it("pr2a-M6: submit-vs-close resolves to ONE coherent outcome — the Slot ends 'closed' with no Proposal left dangling in 'submitted'", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const existing = aProposal(slot.id, "artist-existing");
    await deps.proposals.save(existing);
    const artistAccount = anAccount("artist");
    const artistProfile = aProfile("artist", "active", { accountId: artistAccount.id });
    await deps.profiles.save(artistProfile);
    const artistActor = actorFor(artistAccount, artistProfile);

    const closeCall = closeSlot(actor, { slotId: slot.id }, deps);
    const submitCall = (async () => {
      const { submitProposal } = await import("@application/use-cases/submitProposal");
      return submitProposal(artistActor, { slotId: slot.id, message: "late" }, deps);
    })();

    await Promise.allSettled([closeCall, submitCall]);

    const finalSlot = await deps.slots.findById(slot.id);
    const finalProposals = await deps.proposals.listBySlotId(slot.id);
    expect(finalSlot?.status).toBe("closed");
    expect(finalProposals.filter((p) => p.status === "submitted")).toHaveLength(0);
  });
});
