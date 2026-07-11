import { describe, expect, it } from "vitest";

import { ConflictError, ForbiddenError } from "@application/errors";
import { submitProposal } from "@application/use-cases/submitProposal";
import {
  FakeMatchingUnitOfWork,
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
  return {
    profiles: new InMemoryProfileRepository(),
    slots,
    proposals,
    matchingUnitOfWork: new FakeMatchingUnitOfWork(slots, proposals, events),
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

describe("submitProposal (active-Artist gate, open-Slot only, M2 duplicate guard)", () => {
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
    const account = anAccount("hospital");
    const profile = aProfile("hospital", "active", { accountId: account.id });
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

  it("denies a duplicate concurrent submission by the SAME Artist for the SAME open Slot (M2 DECISION)", async () => {
    const deps = makeDeps();
    const actor = await seedArtist(deps);
    const slot = anOpenSlot();
    await deps.slots.save(slot);

    await submitProposal(actor, { slotId: slot.id, message: "first" }, deps);

    await expect(
      submitProposal(actor, { slotId: slot.id, message: "second" }, deps),
    ).rejects.toBeInstanceOf(ConflictError);
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
});
