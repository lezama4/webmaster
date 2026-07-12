import { describe, expect, it } from "vitest";

import { DomainValidationError, InvalidTransitionError } from "@domain/errors";
import { ForbiddenError, NotFoundError } from "@application/errors";
import { validateProfile } from "@application/use-cases/validateProfile";
import type { Session, SessionPort } from "@application/ports/SessionPort";
import {
  FakeProfileUnitOfWork,
  FakeSessionPort,
  InMemoryProfileRepository,
} from "./support/fakes";
import { actorFor, aProfile, anAccount } from "./support/builders";

function makeDeps() {
  const profiles = new InMemoryProfileRepository();
  const sessions = new FakeSessionPort();
  return {
    profiles,
    sessions,
    profileUnitOfWork: new FakeProfileUnitOfWork(profiles, sessions),
  };
}

const admin = actorFor(anAccount("admin"));

describe("validateProfile (Admin validation queue decision)", () => {
  it("approves a pending profile: pending -> active", async () => {
    const deps = makeDeps();
    const pending = aProfile("hospital", "pending");
    await deps.profiles.save(pending);

    const result = await validateProfile(
      admin,
      { profileId: pending.id, decision: "approve" },
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
      { profileId: pending.id, decision: "reject" },
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
      { profileId: pending.id, decision: "reject" },
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
        { profileId: pending.id, decision: "reject" },
        failingDeps,
      ),
    ).rejects.toThrow("simulated failure");

    // NO partial state: the status transition rolled back alongside the
    // failed revocation — the Profile stays 'pending' and the session lives.
    expect((await deps.profiles.findById(pending.id))?.status).toBe("pending");
    expect(deps.sessions.sessionsForAccount("artist-account-3")).toHaveLength(1);
  });

  it("denies a non-admin actor (Hospital) with ForbiddenError", async () => {
    const deps = makeDeps();
    const pending = aProfile("artist", "pending");
    await deps.profiles.save(pending);
    const hospitalActor = actorFor(anAccount("hospital"));

    await expect(
      validateProfile(
        hospitalActor,
        { profileId: pending.id, decision: "approve" },
        deps,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("fails with NotFoundError for an unknown profile id", async () => {
    const deps = makeDeps();

    await expect(
      validateProfile(admin, { profileId: "missing", decision: "approve" }, deps),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies validating a profile that is not pending (already active)", async () => {
    const deps = makeDeps();
    const active = aProfile("hospital", "active");
    await deps.profiles.save(active);

    await expect(
      validateProfile(admin, { profileId: active.id, decision: "approve" }, deps),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("FAILS CLOSED on a decision that is neither 'approve' nor 'reject' (pr2a-N2) — never falls through to reject", async () => {
    const deps = makeDeps();
    const pending = aProfile("hospital", "pending", { accountId: "acct-n2" });
    await deps.profiles.save(pending);

    await expect(
      validateProfile(
        admin,
        // Simulates a caller that bypasses the TS union (e.g. a malformed
        // JSON body reaching the use case before route-level Zod validation
        // exists) — the use case itself MUST NOT interpret this as "reject".
        { profileId: pending.id, decision: "delete-everything" as never },
        deps,
      ),
    ).rejects.toBeInstanceOf(DomainValidationError);

    // No irreversible state change occurred — the Profile is still pending.
    expect((await deps.profiles.findById(pending.id))?.status).toBe("pending");
  });
});
