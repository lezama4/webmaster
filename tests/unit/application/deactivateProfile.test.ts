import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError } from "@domain/errors";
import { ForbiddenError, NotFoundError } from "@application/errors";
import {
  deactivateProfile,
  type DeactivateProfileInput,
} from "@application/use-cases/deactivateProfile";
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

const AVALID_BASIS = "Convenio lapsed — centre no longer answers verification contact.";

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

describe("deactivateProfile (Admin-only, active -> deactivated, atomic session revocation, M3)", () => {
  it("deactivates an active Profile: active -> deactivated", async () => {
    const deps = makeDeps();
    const active = aProfile("centre", "active", { accountId: "acct-1" });
    await deps.profiles.save(active);

    const result = await deactivateProfile(
      admin,
      { profileId: active.id, basis: AVALID_BASIS },
      deps,
    );

    expect(result.status).toBe("deactivated");
    expect((await deps.profiles.findById(active.id))?.status).toBe("deactivated");
  });

  it("revokes every live session for the Profile's Account atomically (D7/M3)", async () => {
    const deps = makeDeps();
    const active = aProfile("artist", "active", { accountId: "artist-account-1" });
    await deps.profiles.save(active);
    await deps.sessions.create("artist-account-1");
    await deps.sessions.create("artist-account-1");

    await deactivateProfile(admin, { profileId: active.id, basis: AVALID_BASIS }, deps);

    expect(deps.sessions.sessionsForAccount("artist-account-1")).toHaveLength(0);
  });

  it("denies a non-Admin actor (Hospital) with ForbiddenError", async () => {
    const deps = makeDeps();
    const active = aProfile("centre", "active", { accountId: "acct-1" });
    await deps.profiles.save(active);
    const hospitalActor = actorFor(anAccount("centre"));

    await expect(
      deactivateProfile(
        hospitalActor,
        { profileId: active.id, basis: AVALID_BASIS },
        deps,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("fails with NotFoundError for an unknown profile id", async () => {
    const deps = makeDeps();

    await expect(
      deactivateProfile(admin, { profileId: "missing", basis: AVALID_BASIS }, deps),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies deactivating a Profile that is not active (pending)", async () => {
    const deps = makeDeps();
    const pending = aProfile("centre", "pending", { accountId: "acct-1" });
    await deps.profiles.save(pending);

    await expect(
      deactivateProfile(admin, { profileId: pending.id, basis: AVALID_BASIS }, deps),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("leaves NO partial state when session revocation fails mid-transaction (M3 atomicity)", async () => {
    const deps = makeDeps();
    const active = aProfile("artist", "active", { accountId: "artist-account-2" });
    await deps.profiles.save(active);
    await deps.sessions.create("artist-account-2");

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
      deactivateProfile(
        admin,
        { profileId: active.id, basis: AVALID_BASIS },
        failingDeps,
      ),
    ).rejects.toThrow("simulated failure");

    // NO partial state: the status transition rolled back alongside the
    // failed revocation — the Profile stays 'active' and the session lives.
    expect((await deps.profiles.findById(active.id))?.status).toBe("active");
    expect(deps.sessions.sessionsForAccount("artist-account-2")).toHaveLength(1);
    // D23: the review row rolls back too — no partial audit trail either.
    expect(failingProfileUnitOfWork.reviewsForProfile(active.id)).toHaveLength(0);
  });

  describe("ProfileReview persistence (D21-D23, PR2)", () => {
    it("persists a ProfileReview via saveReview in the SAME withLockedProfile call as saveProfile", async () => {
      const deps = makeDeps();
      const active = aProfile("centre", "active", { accountId: "acct-review-1" });
      await deps.profiles.save(active);

      await deactivateProfile(
        admin,
        { profileId: active.id, basis: `  ${AVALID_BASIS}  ` },
        deps,
      );

      const reviews = deps.profileUnitOfWork.reviewsForProfile(active.id);
      expect(reviews).toHaveLength(1);
      expect(reviews[0]).toMatchObject({
        profileId: active.id,
        decision: "deactivate",
        basis: AVALID_BASIS, // trimmed
      });
    });

    it("records actor.accountId as the review's admin id — NOT any input-supplied value", async () => {
      const deps = makeDeps();
      const active = aProfile("artist", "active", { accountId: "acct-review-2" });
      await deps.profiles.save(active);

      const hostileInput = {
        profileId: active.id,
        basis: AVALID_BASIS,
        adminAccountId: "spoofed-admin",
        actorId: "also-spoofed",
      } as unknown as DeactivateProfileInput;

      await deactivateProfile(admin, hostileInput, deps);

      const [review] = deps.profileUnitOfWork.reviewsForProfile(active.id);
      expect(review.adminAccountId).toBe(admin.accountId);
      expect(review.adminAccountId).not.toBe("spoofed-admin");
    });

    it("rejects a blank basis fail-closed: no status change, no review persisted", async () => {
      const deps = makeDeps();
      const active = aProfile("centre", "active", { accountId: "acct-review-3" });
      await deps.profiles.save(active);

      await expect(
        deactivateProfile(admin, { profileId: active.id, basis: "   " }, deps),
      ).rejects.toBeInstanceOf(DomainValidationError);

      expect((await deps.profiles.findById(active.id))?.status).toBe("active");
      expect(deps.profileUnitOfWork.reviewsForProfile(active.id)).toHaveLength(0);
    });

    it("stamps the review id from deps.idGenerator.next() and the timestamp from deps.clock.now()", async () => {
      const deps = makeDeps();
      const active = aProfile("centre", "active", { accountId: "acct-review-4" });
      await deps.profiles.save(active);

      await deactivateProfile(admin, { profileId: active.id, basis: AVALID_BASIS }, deps);

      const [review] = deps.profileUnitOfWork.reviewsForProfile(active.id);
      expect(review.id).toBe("review-1"); // SequentialIdGenerator("review")'s first value
      expect(review.at).toEqual(NOW); // fixedClock
    });
  });
});
