import { describe, expect, it } from "vitest";

import { ConflictError, ForbiddenError, NotFoundError } from "@application/errors";
import { approveProposal } from "@application/use-cases/approveProposal";
import { rejectProposal } from "@application/use-cases/rejectProposal";
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
import {
  actorFor,
  anAccount,
  anOpenSlot,
  aProposal,
  aProfile,
} from "./support/builders";

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
    events,
    matchingUnitOfWork: new FakeMatchingUnitOfWork(slots, proposals, events, profiles),
    profileUnitOfWork: new FakeProfileUnitOfWork(profiles, sessions),
    idGenerator: new SequentialIdGenerator("event"),
    clock: fixedClock,
  };
}

async function seedHospital(
  deps: ReturnType<typeof makeDeps>,
  status: "pending" | "active" | "rejected" | "deactivated" = "active",
) {
  const account = anAccount("centre");
  const profile = aProfile("centre", status, { accountId: account.id });
  await deps.profiles.save(profile);
  return { profile, actor: actorFor(account, profile) };
}

describe("approveProposal (ownership 403, cascade, lock-first, pr2a-M1 live-checked inside the Slot lock)", () => {
  it("approves a submitted Proposal: accepts it, fills the Slot, publishes an Event, auto-rejects rivals", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    const rival = aProposal(slot.id, "artist-2");
    await deps.proposals.save(target);
    await deps.proposals.save(rival);

    const outcome = await approveProposal(
      actor,
      { slotId: slot.id, proposalId: target.id },
      deps,
    );

    expect(outcome.slot.status).toBe("filled");
    expect(outcome.acceptedProposal.status).toBe("accepted");
    expect(outcome.rejectedProposals).toHaveLength(1);
    expect(outcome.rejectedProposals[0].id).toBe(rival.id);
    expect(outcome.event.status).toBe("published");
    expect((await deps.slots.findById(slot.id))?.status).toBe("filled");
    expect((await deps.proposals.findById(rival.id))?.status).toBe("rejected");
  });

  it("locks the Slot FIRST before deciding (D4/B2)", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    await deps.proposals.save(target);

    await approveProposal(actor, { slotId: slot.id, proposalId: target.id }, deps);

    expect(deps.matchingUnitOfWork.lockLog).toEqual([slot.id]);
  });

  it("denies a non-owning Hospital (403)", async () => {
    const deps = makeDeps();
    const { actor } = await seedHospital(deps);
    const otherHospital = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: otherHospital.profile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    await deps.proposals.save(target);

    await expect(
      approveProposal(actor, { slotId: slot.id, proposalId: target.id }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies the Admin role (approval is Hospital-only, M6)", async () => {
    const deps = makeDeps();
    const admin = actorFor(anAccount("admin"));
    const { profile } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    await deps.proposals.save(target);

    await expect(
      approveProposal(admin, { slotId: slot.id, proposalId: target.id }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies approving on a non-open (already filled) Slot with ConflictError", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    const a = aProposal(slot.id, "artist-1");
    const b = aProposal(slot.id, "artist-2");
    await deps.slots.save(slot);
    await deps.proposals.save(a);
    await deps.proposals.save(b);
    await approveProposal(actor, { slotId: slot.id, proposalId: a.id }, deps); // fills it

    await expect(
      approveProposal(actor, { slotId: slot.id, proposalId: b.id }, deps),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("denies when the Proposal does not belong to the targeted Slot (mismatched linkage, M6)", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    const foreignSlot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    await deps.slots.save(foreignSlot);
    const foreignProposal = aProposal(foreignSlot.id, "artist-1");
    await deps.proposals.save(foreignProposal);

    await expect(
      approveProposal(
        actor,
        { slotId: slot.id, proposalId: foreignProposal.id },
        deps,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies an Actor whose Account role is 'hospital' but whose live Profile TYPE is 'artist' (pr2a-N1)", async () => {
    const deps = makeDeps();
    const account = anAccount("centre");
    const mismatchedProfile = aProfile("artist", "active", { accountId: account.id });
    await deps.profiles.save(mismatchedProfile);
    const slot = anOpenSlot({ hospitalProfileId: mismatchedProfile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    await deps.proposals.save(target);

    await expect(
      approveProposal(
        actorFor(account, mismatchedProfile),
        { slotId: slot.id, proposalId: target.id },
        deps,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("pr2a-M1: denies approval when the Hospital's Profile was deactivated between the initial dispatch and the lock — no cascade is committed", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    await deps.proposals.save(target);
    const admin = actorFor(anAccount("admin"));

    const deactivation = deactivateProfile(
      admin,
      { profileId: profile.id, basis: "M1 race test — deactivated mid-flight." },
      deps,
    );
    const approveAttempt = approveProposal(actor, { slotId: slot.id, proposalId: target.id }, deps);

    await expect(deactivation).resolves.toMatchObject({ status: "deactivated" });
    await expect(approveAttempt).rejects.toBeInstanceOf(ForbiddenError);

    expect((await deps.slots.findById(slot.id))?.status).toBe("open");
    expect((await deps.proposals.findById(target.id))?.status).toBe("submitted");
  });
});

describe("rejectProposal (M1: guarded, lock-first, pr2a-M1 live-checked inside the Slot lock)", () => {
  it("rejects a submitted Proposal", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    await deps.proposals.save(target);

    const rejected = await rejectProposal(
      actor,
      { slotId: slot.id, proposalId: target.id },
      deps,
    );

    expect(rejected.status).toBe("rejected");
    expect((await deps.proposals.findById(target.id))?.status).toBe("rejected");
  });

  it("locks the Slot FIRST before deciding (M1)", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    await deps.proposals.save(target);

    await rejectProposal(actor, { slotId: slot.id, proposalId: target.id }, deps);

    expect(deps.matchingUnitOfWork.lockLog).toEqual([slot.id]);
  });

  it("denies a non-owning Hospital (403)", async () => {
    const deps = makeDeps();
    const { actor } = await seedHospital(deps);
    const other = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: other.profile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    await deps.proposals.save(target);

    await expect(
      rejectProposal(actor, { slotId: slot.id, proposalId: target.id }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies the Admin role (rejection is Hospital-only, M6)", async () => {
    const deps = makeDeps();
    const admin = actorFor(anAccount("admin"));
    const { profile } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    await deps.proposals.save(target);

    await expect(
      rejectProposal(admin, { slotId: slot.id, proposalId: target.id }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies rejecting an already-terminal Proposal (already accepted) with ConflictError", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    const a = aProposal(slot.id, "artist-1");
    const b = aProposal(slot.id, "artist-2");
    await deps.slots.save(slot);
    await deps.proposals.save(a);
    await deps.proposals.save(b);
    await approveProposal(actor, { slotId: slot.id, proposalId: a.id }, deps);

    await expect(
      rejectProposal(actor, { slotId: slot.id, proposalId: b.id }, deps),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("denies when the Proposal does not belong to the targeted Slot (mismatched linkage)", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    const foreignSlot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    await deps.slots.save(foreignSlot);
    const foreignProposal = aProposal(foreignSlot.id, "artist-1");
    await deps.proposals.save(foreignProposal);

    await expect(
      rejectProposal(
        actor,
        { slotId: slot.id, proposalId: foreignProposal.id },
        deps,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("pr2a-M1: denies rejection when the Hospital's Profile was deactivated between the initial dispatch and the lock", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    await deps.proposals.save(target);
    const admin = actorFor(anAccount("admin"));

    const deactivation = deactivateProfile(
      admin,
      { profileId: profile.id, basis: "M1 race test — deactivated mid-flight." },
      deps,
    );
    const rejectAttempt = rejectProposal(actor, { slotId: slot.id, proposalId: target.id }, deps);

    await expect(deactivation).resolves.toMatchObject({ status: "deactivated" });
    await expect(rejectAttempt).rejects.toBeInstanceOf(ForbiddenError);

    expect((await deps.proposals.findById(target.id))?.status).toBe("submitted");
  });
});

describe("Cross-use-case concurrency on the SAME Slot (pr2a-M6): concurrent Slot decisions resolve to ONE coherent outcome", () => {
  it("submit-vs-approve: whichever wins the shared Slot-lock queue, the final state has exactly one 'accepted' Proposal and none left dangling in 'submitted'", async () => {
    const deps = makeDeps();
    const { profile, actor: hospitalActor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const rival = aProposal(slot.id, "artist-rival");
    await deps.proposals.save(rival);
    const artistAccount = anAccount("artist");
    const artistProfile = aProfile("artist", "active", { accountId: artistAccount.id });
    await deps.profiles.save(artistProfile);
    const artistActor = actorFor(artistAccount, artistProfile);

    const submitCall = (async () => {
      const { submitProposal } = await import("@application/use-cases/submitProposal");
      return submitProposal(artistActor, { slotId: slot.id, message: "late entry" }, deps);
    })();
    const approveCall = approveProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: rival.id },
      deps,
    );

    await Promise.allSettled([submitCall, approveCall]);

    const finalSlot = await deps.slots.findById(slot.id);
    const finalProposals = await deps.proposals.listBySlotId(slot.id);
    expect(finalSlot?.status).toBe("filled");
    expect(finalProposals.filter((p) => p.status === "accepted")).toHaveLength(1);
    expect(finalProposals.filter((p) => p.status === "submitted")).toHaveLength(0);
  });

  it("approve-vs-reject on DIFFERENT Proposals for the SAME Slot: the final state is identical regardless of which commits first", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const a = aProposal(slot.id, "artist-a");
    const b = aProposal(slot.id, "artist-b");
    await deps.proposals.save(a);
    await deps.proposals.save(b);

    const approveCall = approveProposal(actor, { slotId: slot.id, proposalId: a.id }, deps);
    const rejectCall = rejectProposal(actor, { slotId: slot.id, proposalId: b.id }, deps);

    await Promise.allSettled([approveCall, rejectCall]);

    const finalSlot = await deps.slots.findById(slot.id);
    expect(finalSlot?.status).toBe("filled");
    expect((await deps.proposals.findById(a.id))?.status).toBe("accepted");
    // Rejected either by the explicit reject call or by approve's auto-reject cascade — either way, terminal 'rejected'.
    expect((await deps.proposals.findById(b.id))?.status).toBe("rejected");
  });

  it("approve-vs-close: whichever wins the lock, the Slot ends in a single valid terminal state, never a mixed/corrupt one", async () => {
    const deps = makeDeps();
    const { profile, actor } = await seedHospital(deps);
    const slot = anOpenSlot({ hospitalProfileId: profile.id });
    await deps.slots.save(slot);
    const target = aProposal(slot.id, "artist-1");
    await deps.proposals.save(target);

    const { closeSlot } = await import("@application/use-cases/closeSlot");
    const approveCall = approveProposal(actor, { slotId: slot.id, proposalId: target.id }, deps);
    const closeCall = closeSlot(actor, { slotId: slot.id }, deps);

    const [approveOutcome, closeOutcome] = await Promise.allSettled([approveCall, closeCall]);

    const finalSlot = await deps.slots.findById(slot.id);
    // The Slot lock serializes the two calls in dispatch order: approve was
    // dispatched first, so it wins — 'filled', target 'accepted', close
    // observes a non-open Slot and is denied with ConflictError.
    expect(approveOutcome.status).toBe("fulfilled");
    expect(closeOutcome.status).toBe("rejected");
    expect(finalSlot?.status).toBe("filled");
    expect((await deps.proposals.findById(target.id))?.status).toBe("accepted");
  });
});
