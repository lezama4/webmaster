import { describe, expect, it } from "vitest";

import { ConflictError, ForbiddenError } from "@application/errors";
import { closeSlot } from "@application/use-cases/closeSlot";
import { approveProposal } from "@application/use-cases/approveProposal";
import {
  fixedClock,
  FakeMatchingUnitOfWork,
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
  return {
    profiles: new InMemoryProfileRepository(),
    slots,
    proposals,
    matchingUnitOfWork: new FakeMatchingUnitOfWork(slots, proposals, events),
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

describe("closeSlot (owner-Hospital-only, cascades reject, lock-first, B2)", () => {
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
});
