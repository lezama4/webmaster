import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError } from "@domain/errors";
import { ForbiddenError, NotFoundError } from "@application/errors";
import { validateProfile, type ValidateProfileInput } from "@application/use-cases/validateProfile";
import type { Session, SessionPort } from "@application/ports/SessionPort";
import {
  FakeProfileUnitOfWork,
  FakeSessionPort,
  InMemoryProfileRepository,
  SequentialIdGenerator,
  fixedClock,
  NOW,
} from "./support/fakes";
import { actorFor, aProfile, anAccount } from "./support/builders";

const AVALID_BASIS =
  "Convenio VTT-2026-014 verified by phone with the centre's named contact on 2026-07-20.";

function makeDeps() {
  const profiles = new InMemoryProfileRepository();
  const sessions = new FakeSessionPort();
  return {
    profiles,
    sessions,
    profileUnitOfWork: new FakeProfileUnitOfWork(profiles, sessions),
    idGenerator: new SequentialIdGenerator("review"),
    clock: fixedClock,
  };
}

const admin = actorFor(anAccount("admin"));

describe("validateProfile (Admin validation queue decision)", () => {
  it("approves a pending profile: pending -> active", async () => {
    const deps = makeDeps();
    const pending = aProfile("centre", "pending");
    await deps.profiles.save(pending);

    const result = await validateProfile(
      admin,
      { profileId: pending.id, decision: "approve", basis: AVALID_BASIS },
      deps,
    );

    expect(result.status).toBe("active");
    expect((await deps.profiles.findById(pending.id))?.status).toBe("active");
  });

  it("rejects a pending profile: pending -> rejected", async () => {
    const deps = makeDeps();
    const pending = aProfile("artist", "pending");
    await deps.profiles.save(pending);

    const result = await validateProfile(
      admin,
      { profileId: pending.id, decision: "reject", basis: AVALID_BASIS },
      deps,
    );

    expect(result.status).toBe("rejected");
    expect((await deps.profiles.findById(pending.id))?.status).toBe("rejected");
  });

  it("rejecting revokes every live session for the profile's account (D7/M3)", async () => {
    const deps = makeDeps();
    const pending = aProfile("artist", "pending", {
      accountId: "artist-account-1",
    });
    await deps.profiles.save(pending);
    await deps.sessions.create("artist-account-1");
    await deps.sessions.create("artist-account-1");

    await validateProfile(
      admin,
      { profileId: pending.id, decision: "reject", basis: AVALID_BASIS },
      deps,
    );

    expect(deps.sessions.sessionsForAccount("artist-account-1")).toHaveLength(0);
  });

  it("leaves NO partial state when reject's session revocation fails mid-transaction (M3 atomicity)", async () => {
    const deps = makeDeps();
    const pending = aProfile("artist", "pending", {
      accountId: "artist-account-3",
    });
    await deps.profiles.save(pending);
    await deps.sessions.create("artist-account-3");

    class ThrowOnceOnRevokeAll implements SessionPort {
      constructor(private readonly inner: SessionPort) {}
      create(accountId: string): Promise<Session> {
        return this.inner.create(accountId);
      }
      resolveValid(sessionId: string): Promise<Session | null> {
        return this.inner.resolveValid(sessionId);
      }
      touch(sessionId: string): Promise<boolean> {
        return this.inner.touch(sessionId);
      }
      revokeOne(sessionId: string): Promise<void> {
        return this.inner.revokeOne(sessionId);
      }
      async revokeAllForAccount(accountId: string): Promise<void> {
        void accountId;
        throw new Error("simulated failure between transition and revocation");
      }
    }

    const failingProfileUnitOfWork = new FakeProfileUnitOfWork(
      deps.profiles,
      deps.sessions,
      new ThrowOnceOnRevokeAll(deps.sessions),
    );
    const failingDeps = { ...deps, profileUnitOfWork: failingProfileUnitOfWork };

    await expect(
      validateProfile(
        admin,
        { profileId: pending.id, decision: "reject", basis: AVALID_BASIS },
        failingDeps,
      ),
    ).rejects.toThrow("simulated failure");

    // NO partial state: the status transition rolled back alongside the
    // failed revocation — the Profile stays 'pending' and the session lives.
    expect((await deps.profiles.findById(pending.id))?.status).toBe("pending");
    expect(deps.sessions.sessionsForAccount("artist-account-3")).toHaveLength(1);
    // D23: the review row rolls back too — no partial audit trail either.
    expect(failingProfileUnitOfWork.reviewsForProfile(pending.id)).toHaveLength(0);
  });

  it("denies a non-admin actor (Hospital) with ForbiddenError", async () => {
    const deps = makeDeps();
    const pending = aProfile("artist", "pending");
    await deps.profiles.save(pending);
    const hospitalActor = actorFor(anAccount("centre"));

    await expect(
      validateProfile(
        hospitalActor,
        { profileId: pending.id, decision: "approve", basis: AVALID_BASIS },
        deps,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("fails with NotFoundError for an unknown profile id", async () => {
    const deps = makeDeps();

    await expect(
      validateProfile(
        admin,
        { profileId: "missing", decision: "approve", basis: AVALID_BASIS },
        deps,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies validating a profile that is not pending (already active)", async () => {
    const deps = makeDeps();
    const active = aProfile("centre", "active");
    await deps.profiles.save(active);

    await expect(
      validateProfile(
        admin,
        { profileId: active.id, decision: "approve", basis: AVALID_BASIS },
        deps,
      ),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("FAILS CLOSED on a decision that is neither 'approve' nor 'reject' (pr2a-N2) — never falls through to reject", async () => {
    const deps = makeDeps();
    const pending = aProfile("centre", "pending", { accountId: "acct-n2" });
    await deps.profiles.save(pending);

    await expect(
      validateProfile(
        admin,
        // Simulates a caller that bypasses the TS union (e.g. a malformed
        // JSON body reaching the use case before route-level Zod validation
        // exists) — the use case itself MUST NOT interpret this as "reject".
        { profileId: pending.id, decision: "delete-everything" as never, basis: AVALID_BASIS },
        deps,
      ),
    ).rejects.toBeInstanceOf(DomainValidationError);

    // No irreversible state change occurred — the Profile is still pending.
    expect((await deps.profiles.findById(pending.id))?.status).toBe("pending");
  });

  describe("ProfileReview persistence (D21-D23, PR2)", () => {
    it("persists a ProfileReview via saveReview in the SAME withLockedProfile call as saveProfile", async () => {
      const deps = makeDeps();
      const pending = aProfile("centre", "pending");
      await deps.profiles.save(pending);

      await validateProfile(
        admin,
        { profileId: pending.id, decision: "approve", basis: `  ${AVALID_BASIS}  ` },
        deps,
      );

      const reviews = deps.profileUnitOfWork.reviewsForProfile(pending.id);
      expect(reviews).toHaveLength(1);
      expect(reviews[0]).toMatchObject({
        profileId: pending.id,
        decision: "approve",
        basis: AVALID_BASIS, // trimmed
      });
    });

    it("records actor.accountId as the review's admin id — NOT any input-supplied value", async () => {
      const deps = makeDeps();
      const pending = aProfile("artist", "pending");
      await deps.profiles.save(pending);

      // Simulates a scripted request that also smuggles an (ignored) client-
      // supplied admin identity alongside the real input fields.
      const hostileInput = {
        profileId: pending.id,
        decision: "reject",
        basis: AVALID_BASIS,
        adminAccountId: "spoofed-admin",
        actorId: "also-spoofed",
      } as unknown as ValidateProfileInput;

      await validateProfile(admin, hostileInput, deps);

      const [review] = deps.profileUnitOfWork.reviewsForProfile(pending.id);
      expect(review.adminAccountId).toBe(admin.accountId);
      expect(review.adminAccountId).not.toBe("spoofed-admin");
    });

    it("rejects a blank basis fail-closed: no status change, no review persisted", async () => {
      const deps = makeDeps();
      const pending = aProfile("centre", "pending");
      await deps.profiles.save(pending);

      await expect(
        validateProfile(
          admin,
          { profileId: pending.id, decision: "approve", basis: "   " },
          deps,
        ),
      ).rejects.toBeInstanceOf(DomainValidationError);

      expect((await deps.profiles.findById(pending.id))?.status).toBe("pending");
      expect(deps.profileUnitOfWork.reviewsForProfile(pending.id)).toHaveLength(0);
    });

    it("stamps the review id from deps.idGenerator.next() and the timestamp from deps.clock.now()", async () => {
      const deps = makeDeps();
      const pending = aProfile("centre", "pending");
      await deps.profiles.save(pending);

      await validateProfile(
        admin,
        { profileId: pending.id, decision: "approve", basis: AVALID_BASIS },
        deps,
      );

      const [review] = deps.profileUnitOfWork.reviewsForProfile(pending.id);
      expect(review.id).toBe("review-1"); // SequentialIdGenerator("review")'s first value
      expect(review.at).toEqual(NOW); // fixedClock
    });
  });
});
