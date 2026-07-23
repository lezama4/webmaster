import { describe, expect, it } from "vitest";

import { InvalidTransitionError } from "@domain/errors";
import { ForbiddenError, NotFoundError } from "@application/errors";
import { deactivateProfile } from "@application/use-cases/deactivateProfile";
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

describe("deactivateProfile (Admin-only, active -> deactivated, atomic session revocation, M3)", () => {
  it("deactivates an active Profile: active -> deactivated", async () => {
    const deps = makeDeps();
    const active = aProfile("centre", "active", { accountId: "acct-1" });
    await deps.profiles.save(active);

    const result = await deactivateProfile(admin, { profileId: active.id }, deps);

    expect(result.status).toBe("deactivated");
    expect((await deps.profiles.findById(active.id))?.status).toBe("deactivated");
  });

  it("revokes every live session for the Profile's Account atomically (D7/M3)", async () => {
    const deps = makeDeps();
    const active = aProfile("artist", "active", { accountId: "artist-account-1" });
    await deps.profiles.save(active);
    await deps.sessions.create("artist-account-1");
    await deps.sessions.create("artist-account-1");

    await deactivateProfile(admin, { profileId: active.id }, deps);

    expect(deps.sessions.sessionsForAccount("artist-account-1")).toHaveLength(0);
  });

  it("denies a non-Admin actor (Hospital) with ForbiddenError", async () => {
    const deps = makeDeps();
    const active = aProfile("centre", "active", { accountId: "acct-1" });
    await deps.profiles.save(active);
    const hospitalActor = actorFor(anAccount("centre"));

    await expect(
      deactivateProfile(hospitalActor, { profileId: active.id }, deps),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("fails with NotFoundError for an unknown profile id", async () => {
    const deps = makeDeps();

    await expect(
      deactivateProfile(admin, { profileId: "missing" }, deps),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies deactivating a Profile that is not active (pending)", async () => {
    const deps = makeDeps();
    const pending = aProfile("centre", "pending", { accountId: "acct-1" });
    await deps.profiles.save(pending);

    await expect(
      deactivateProfile(admin, { profileId: pending.id }, deps),
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
      deactivateProfile(admin, { profileId: active.id }, failingDeps),
    ).rejects.toThrow("simulated failure");

    // NO partial state: the status transition rolled back alongside the
    // failed revocation — the Profile stays 'active' and the session lives.
    expect((await deps.profiles.findById(active.id))?.status).toBe("active");
    expect(deps.sessions.sessionsForAccount("artist-account-2")).toHaveLength(1);
  });
});
