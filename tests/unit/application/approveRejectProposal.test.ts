import { describe, expect, it } from "vitest";

import { ConflictError, ForbiddenError, NotFoundError } from "@application/errors";
import { approveProposal } from "@application/use-cases/approveProposal";
import { rejectProposal } from "@application/use-cases/rejectProposal";
import {
  fixedClock,
  FakeMatchingUnitOfWork,
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
  return {
    profiles: new InMemoryProfileRepository(),
    slots,
    proposals,
    events,
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

describe("approveProposal (ownership 403, cascade, lock-first)", () => {
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
});

describe("rejectProposal (M1: guarded, lock-first)", () => {
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
});
