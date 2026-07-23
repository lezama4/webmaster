import { describe, expect, it } from "vitest";

import { ConflictError, ForbiddenError } from "@application/errors";
import { submitProposal } from "@application/use-cases/submitProposal";
import { deactivateProfile } from "@application/use-cases/deactivateProfile";
import {
  FakeMatchingUnitOfWork,
  FakeProfileUnitOfWork,
  FakeSessionPort,
  InMemoryEventRepository,
  InMemoryProfileRepository,
  InMemoryProposalRepository,
  InMemorySlotRepository,
  SequentialIdGenerator,
} from "./support/fakes";
import { actorFor, anAccount, anOpenSlot, aProfile } from "./support/builders";

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
    matchingUnitOfWork: new FakeMatchingUnitOfWork(slots, proposals, events, profiles),
    profileUnitOfWork: new FakeProfileUnitOfWork(profiles, sessions),
    idGenerator: new SequentialIdGenerator("proposal"),
  };
}

async function seedArtist(
  deps: ReturnType<typeof makeDeps>,
  status: "pending" | "active" | "rejected" | "deactivated" = "active",
) {
  const account = anAccount("artist");
  const profile = aProfile("artist", status, { accountId: account.id });
  await deps.profiles.save(profile);
  return actorFor(account, profile);
}

describe("submitProposal (active-Artist gate, open-Slot only, M2 duplicate guard, pr2a-M1 live-checked inside the Slot lock)", () => {
  it("submits a Proposal against an 'open' Slot", async () => {
    const deps = makeDeps();
    const actor = await seedArtist(deps);
    const slot = anOpenSlot();
    await deps.slots.save(slot);

    const proposal = await submitProposal(
      actor,
      { slotId: slot.id, message: "I would love to play." },
      deps,
    );

    expect(proposal.status).toBe("submitted");
    expect(proposal.slotId).toBe(slot.id);
    expect(proposal.artistProfileId).toBe(actor.profileId);
    expect(await deps.proposals.findById(proposal.id)).not.toBeNull();
  });

  it("locks the Slot FIRST (lock-first, D4/B2) before deciding", async () => {
    const deps = makeDeps();
    const actor = await seedArtist(deps);
    const slot = anOpenSlot();
    await deps.slots.save(slot);

    await submitProposal(actor, { slotId: slot.id, message: "hi" }, deps);

    expect(deps.matchingUnitOfWork.lockLog).toEqual([slot.id]);
  });

  it("denies a pending (inactive) Artist", async () => {
    const deps = makeDeps();
    const actor = await seedArtist(deps, "pending");
    const slot = anOpenSlot();
    await deps.slots.save(slot);

    await expect(
      submitProposal(actor, { slotId: slot.id, message: "hi" }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies a non-Artist actor (Hospital)", async () => {
    const deps = makeDeps();
    const account = anAccount("centre");
    const profile = aProfile("centre", "active", { accountId: account.id });
    await deps.profiles.save(profile);
    const slot = anOpenSlot();
    await deps.slots.save(slot);

    await expect(
      submitProposal(
        actorFor(account, profile),
        { slotId: slot.id, message: "hi" },
        deps,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies an Actor whose Account role is 'artist' but whose live Profile TYPE is 'hospital' (pr2a-N1)", async () => {
    const deps = makeDeps();
    const account = anAccount("artist");
    const mismatchedProfile = aProfile("centre", "active", { accountId: account.id });
    await deps.profiles.save(mismatchedProfile);
    const slot = anOpenSlot();
    await deps.slots.save(slot);

    await expect(
      submitProposal(
        actorFor(account, mismatchedProfile),
        { slotId: slot.id, message: "hi" },
        deps,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies submitting against a non-open (filled) Slot with ConflictError", async () => {
    const deps = makeDeps();
    const actor = await seedArtist(deps);
    const slot = anOpenSlot();
    await deps.slots.save(slot);
    // Fill the slot directly via the repository to simulate an already-decided Slot.
    const { fillSlot } = await import("@domain/slot/Slot");
    await deps.slots.save(fillSlot(slot));

    await expect(
      submitProposal(actor, { slotId: slot.id, message: "hi" }, deps),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("denies a duplicate concurrent submission by the SAME Artist for the SAME open Slot, started WITHOUT awaiting between the two calls (pr2a-M6: genuinely concurrent, not sequential)", async () => {
    const deps = makeDeps();
    const actor = await seedArtist(deps);
    const slot = anOpenSlot();
    await deps.slots.save(slot);

    const first = submitProposal(actor, { slotId: slot.id, message: "first" }, deps);
    const second = submitProposal(actor, { slotId: slot.id, message: "second" }, deps);

    const [firstResult, secondResult] = await Promise.allSettled([first, second]);
    const fulfilled = [firstResult, secondResult].filter((r) => r.status === "fulfilled");
    const rejected = [firstResult, secondResult].filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    // ONE coherent outcome: exactly one 'submitted' Proposal for this Artist/Slot pair.
    const finalProposals = await deps.proposals.listBySlotId(slot.id);
    expect(
      finalProposals.filter((p) => p.artistProfileId === actor.profileId && p.status === "submitted"),
    ).toHaveLength(1);
  });

  it("allows a new submission from the SAME Artist once their prior one is 'rejected' (resubmit)", async () => {
    const deps = makeDeps();
    const actor = await seedArtist(deps);
    const slot = anOpenSlot();
    await deps.slots.save(slot);
    const first = await submitProposal(
      actor,
      { slotId: slot.id, message: "first" },
      deps,
    );
    const { rejectProposal: domainReject } = await import(
      "@domain/proposal/Proposal"
    );
    await deps.proposals.save(domainReject(first));

    const second = await submitProposal(
      actor,
      { slotId: slot.id, message: "second" },
      deps,
    );

    expect(second.status).toBe("submitted");
  });

  it("pr2a-M1: denies submission when the Artist's Profile was deactivated between the initial dispatch and the lock — no Proposal is created", async () => {
    const deps = makeDeps();
    const actor = await seedArtist(deps, "active");
    const slot = anOpenSlot();
    await deps.slots.save(slot);
    const admin = actorFor(anAccount("admin"));

    // Both share the SAME ProfileUnitOfWork queue. deactivateProfile has
    // fewer intervening awaits before reaching `withLockedProfile` than
    // submitProposal's nested check (which is preceded by the Slot lock's
    // own reads), so the deactivation reliably commits first.
    const deactivation = deactivateProfile(admin, { profileId: actor.profileId! }, deps);
    const submitAttempt = submitProposal(actor, { slotId: slot.id, message: "hi" }, deps);

    await expect(deactivation).resolves.toMatchObject({ status: "deactivated" });
    await expect(submitAttempt).rejects.toBeInstanceOf(ForbiddenError);

    expect(await deps.proposals.listBySlotId(slot.id)).toHaveLength(0);
  });
});
