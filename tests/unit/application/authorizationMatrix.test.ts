import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@application/errors";
import { publishSlot } from "@application/use-cases/publishSlot";
import { submitProposal } from "@application/use-cases/submitProposal";
import { approveProposal } from "@application/use-cases/approveProposal";
import { rejectProposal } from "@application/use-cases/rejectProposal";
import { closeSlot } from "@application/use-cases/closeSlot";
import { deactivateProfile } from "@application/use-cases/deactivateProfile";
import { validateProfile } from "@application/use-cases/validateProfile";
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
import { actorFor, anAccount, anOpenSlot, aProfile, aProposal } from "./support/builders";

/**
 * M6 denial matrix (task 3.24/3.25): the pieces already exercised per-use-
 * case (ownership 403, mismatched proposal/slot, terminal-Proposal denial,
 * Admin denied on approve/reject, non-Hospital/non-Artist denied) are
 * covered inline in each use case's own test file. This file focuses on the
 * cross-cutting case those files don't each repeat: an Actor whose
 * `profileStatus` SNAPSHOT (captured at session issuance) says 'active' but
 * whose LIVE Profile in the repository has since turned 'rejected' or
 * 'deactivated' — every mutating use case MUST deny based on the live read,
 * never the stale snapshot.
 */
function makeSlotDeps() {
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
    idGenerator: new SequentialIdGenerator("x"),
    clock: fixedClock,
  };
}

function makeProfileDeps() {
  const profiles = new InMemoryProfileRepository();
  const sessions = new FakeSessionPort();
  return {
    profiles,
    sessions,
    profileUnitOfWork: new FakeProfileUnitOfWork(profiles, sessions),
  };
}

describe("Authorization edge-case matrix — stale session snapshot vs. live status (M6)", () => {
  it("publishSlot denies a Hospital whose stale actor snapshot says 'active' but the LIVE Profile is 'deactivated'", async () => {
    const deps = makeSlotDeps();
    const account = anAccount("hospital");
    const stillActiveSnapshot = aProfile("hospital", "active", {
      accountId: account.id,
    });
    const actor = actorFor(account, stillActiveSnapshot); // snapshot: 'active'
    // The Admin deactivates it AFTER the actor object was built (simulating
    // a status change mid-session) — the repository now holds 'deactivated'.
    const deactivated = aProfile("hospital", "deactivated", {
      id: stillActiveSnapshot.id,
      accountId: account.id,
    });
    await deps.profiles.save(deactivated);

    await expect(
      publishSlot(
        actor,
        {
          title: "Acoustic guitar afternoon",
          description: "desc",
          scheduledAt: new Date("2026-08-01T17:00:00Z"),
          durationMinutes: 60,
          location: "Ward 3",
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("submitProposal denies an Artist whose stale actor snapshot says 'active' but the LIVE Profile is 'rejected'", async () => {
    const deps = makeSlotDeps();
    const account = anAccount("artist");
    const activeSnapshot = aProfile("artist", "active", { accountId: account.id });
    const actor = actorFor(account, activeSnapshot);
    const rejected = aProfile("artist", "rejected", {
      id: activeSnapshot.id,
      accountId: account.id,
    });
    await deps.profiles.save(rejected);
    const slot = anOpenSlot();
    await deps.slots.save(slot);

    await expect(
      submitProposal(actor, { slotId: slot.id, message: "hi" }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("approveProposal denies a Hospital whose stale actor snapshot says 'active' but the LIVE Profile is 'deactivated'", async () => {
    const deps = makeSlotDeps();
    const account = anAccount("hospital");
    const activeSnapshot = aProfile("hospital", "active", { accountId: account.id });
    const actor = actorFor(account, activeSnapshot);
    const deactivated = aProfile("hospital", "deactivated", {
      id: activeSnapshot.id,
      accountId: account.id,
    });
    await deps.profiles.save(deactivated);
    const slot = anOpenSlot({ hospitalProfileId: deactivated.id });
    await deps.slots.save(slot);
    const proposal = aProposal(slot.id, "artist-1");
    await deps.proposals.save(proposal);

    await expect(
      approveProposal(actor, { slotId: slot.id, proposalId: proposal.id }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejectProposal denies a Hospital whose LIVE Profile turned 'rejected' mid-session", async () => {
    const deps = makeSlotDeps();
    const account = anAccount("hospital");
    const activeSnapshot = aProfile("hospital", "active", { accountId: account.id });
    const actor = actorFor(account, activeSnapshot);
    const rejected = aProfile("hospital", "rejected", {
      id: activeSnapshot.id,
      accountId: account.id,
    });
    await deps.profiles.save(rejected);
    const slot = anOpenSlot({ hospitalProfileId: rejected.id });
    await deps.slots.save(slot);
    const proposal = aProposal(slot.id, "artist-1");
    await deps.proposals.save(proposal);

    await expect(
      rejectProposal(actor, { slotId: slot.id, proposalId: proposal.id }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("closeSlot denies a Hospital whose LIVE Profile turned 'deactivated' mid-session", async () => {
    const deps = makeSlotDeps();
    const account = anAccount("hospital");
    const activeSnapshot = aProfile("hospital", "active", { accountId: account.id });
    const actor = actorFor(account, activeSnapshot);
    const deactivated = aProfile("hospital", "deactivated", {
      id: activeSnapshot.id,
      accountId: account.id,
    });
    await deps.profiles.save(deactivated);
    const slot = anOpenSlot({ hospitalProfileId: deactivated.id });
    await deps.slots.save(slot);

    await expect(closeSlot(actor, { slotId: slot.id }, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("Admin cannot approveProposal/rejectProposal (Hospital-only, not a role gap in Admin's favor)", async () => {
    const deps = makeSlotDeps();
    const admin = actorFor(anAccount("admin"));
    const hospitalAccount = anAccount("hospital");
    const hospitalProfile = aProfile("hospital", "active", {
      accountId: hospitalAccount.id,
    });
    await deps.profiles.save(hospitalProfile);
    const slot = anOpenSlot({ hospitalProfileId: hospitalProfile.id });
    await deps.slots.save(slot);
    const proposal = aProposal(slot.id, "artist-1");
    await deps.proposals.save(proposal);

    await expect(
      approveProposal(admin, { slotId: slot.id, proposalId: proposal.id }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      rejectProposal(admin, { slotId: slot.id, proposalId: proposal.id }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("an Artist/Patient cannot reach Admin-only validateProfile/deactivateProfile", async () => {
    const deps = makeProfileDeps();
    const artist = actorFor(anAccount("artist"));
    const patient = actorFor(anAccount("patient"));
    const pending = aProfile("artist", "pending", { accountId: "acct-x" });
    await deps.profiles.save(pending);

    await expect(
      validateProfile(artist, { profileId: pending.id, decision: "approve" }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      deactivateProfile(patient, { profileId: pending.id }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("an Artist/Patient cannot reach Hospital-only publishSlot/closeSlot", async () => {
    const deps = makeSlotDeps();
    const artist = actorFor(anAccount("artist"));
    const patient = actorFor(anAccount("patient"));

    await expect(
      publishSlot(
        artist,
        {
          title: "x",
          description: "y",
          scheduledAt: new Date("2026-08-01T17:00:00Z"),
          durationMinutes: 30,
          location: "z",
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      closeSlot(patient, { slotId: "any-slot" }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
