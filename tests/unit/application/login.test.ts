import { describe, expect, it } from "vitest";

import { UnauthenticatedError } from "@application/errors";
import { login } from "@application/use-cases/login";
import { logout } from "@application/use-cases/logout";
import { deactivateProfile } from "@application/use-cases/deactivateProfile";
import {
  FakeLoginRateLimiter,
  FakePasswordHasher,
  FakeProfileUnitOfWork,
  FakeSessionPort,
  InMemoryAccountRepository,
  InMemoryProfileRepository,
} from "./support/fakes";
import { actorFor, aProfile, anAccount } from "./support/builders";

function makeDeps() {
  const accounts = new InMemoryAccountRepository();
  const profiles = new InMemoryProfileRepository();
  const sessions = new FakeSessionPort();
  return {
    accounts,
    profiles,
    sessions,
    passwordHasher: new FakePasswordHasher(),
    rateLimiter: new FakeLoginRateLimiter(),
    profileUnitOfWork: new FakeProfileUnitOfWork(profiles, sessions),
  };
}

async function seedArtist(
  deps: ReturnType<typeof makeDeps>,
  status: "pending" | "active" | "rejected" | "deactivated" = "active",
) {
  const account = anAccount("artist", { email: "artist.clara@vtt.test" });
  await deps.accounts.save({ account, passwordHash: "hashed:S3cure!pass" });
  const profile = aProfile("artist", status, { accountId: account.id });
  await deps.profiles.save(profile);
  return { account, profile };
}

describe("login", () => {
  it("issues a session for valid credentials and an active profile", async () => {
    const deps = makeDeps();
    const { account } = await seedArtist(deps, "active");

    const result = await login(
      { email: "artist.clara@vtt.test", password: "S3cure!pass" },
      deps,
    );

    expect(result.account.id).toBe(account.id);
    expect(result.session.accountId).toBe(account.id);
    expect(deps.sessions.sessionsForAccount(account.id)).toHaveLength(1);
    expect(deps.rateLimiter.successes).toHaveLength(1);
  });

  it("rotates the session id: every login issues a FRESH id (fixation guard)", async () => {
    const deps = makeDeps();
    await seedArtist(deps, "active");

    const first = await login(
      { email: "artist.clara@vtt.test", password: "S3cure!pass" },
      deps,
    );
    const second = await login(
      { email: "artist.clara@vtt.test", password: "S3cure!pass" },
      deps,
    );

    expect(second.session.id).not.toBe(first.session.id);
  });

  it("logs in an admin (no Profile row required, D2)", async () => {
    const deps = makeDeps();
    const account = anAccount("admin", { email: "admin@vtt.test" });
    await deps.accounts.save({ account, passwordHash: "hashed:S3cure!pass" });

    const result = await login(
      { email: "admin@vtt.test", password: "S3cure!pass" },
      deps,
    );

    expect(result.session.accountId).toBe(account.id);
  });

  it("denies invalid credentials, records the failure, issues no session", async () => {
    const deps = makeDeps();
    const { account } = await seedArtist(deps, "active");

    await expect(
      login({ email: "artist.clara@vtt.test", password: "wrong" }, deps),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(deps.rateLimiter.failures).toHaveLength(1);
    expect(deps.sessions.sessionsForAccount(account.id)).toHaveLength(0);
  });

  it("denies an unknown account with the SAME generic error as a locked-out one (M4: no oracle)", async () => {
    const deps = makeDeps();
    await seedArtist(deps, "active");
    deps.rateLimiter.blockedEmails.add("artist.clara@vtt.test");

    const unknownError = (await login(
      { email: "nobody@vtt.test", password: "S3cure!pass" },
      deps,
    ).catch((e: unknown) => e)) as Error;
    const lockedOutError = (await login(
      { email: "artist.clara@vtt.test", password: "S3cure!pass" },
      deps,
    ).catch((e: unknown) => e)) as Error;

    expect(unknownError).toBeInstanceOf(UnauthenticatedError);
    expect(lockedOutError).toBeInstanceOf(UnauthenticatedError);
    expect(lockedOutError.message).toBe(unknownError.message);
    expect(lockedOutError.name).toBe(unknownError.name);
  });

  it("denies a rate-limited login BEFORE verifying credentials (no session issued)", async () => {
    const deps = makeDeps();
    const { account } = await seedArtist(deps, "active");
    deps.rateLimiter.blockedEmails.add("artist.clara@vtt.test");

    await expect(
      login({ email: "artist.clara@vtt.test", password: "S3cure!pass" }, deps),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(deps.sessions.sessionsForAccount(account.id)).toHaveLength(0);
  });

  it("denies login for a deactivated profile with the same generic error", async () => {
    const deps = makeDeps();
    const { account } = await seedArtist(deps, "deactivated");

    await expect(
      login({ email: "artist.clara@vtt.test", password: "S3cure!pass" }, deps),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(deps.sessions.sessionsForAccount(account.id)).toHaveLength(0);
  });

  it("denies login for a rejected profile (sessions were revoked on rejection, D7)", async () => {
    const deps = makeDeps();
    const { account } = await seedArtist(deps, "rejected");

    await expect(
      login({ email: "artist.clara@vtt.test", password: "S3cure!pass" }, deps),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(deps.sessions.sessionsForAccount(account.id)).toHaveLength(0);
  });

  it("allows login for a pending profile (may check status; role actions stay blocked)", async () => {
    const deps = makeDeps();
    const { account } = await seedArtist(deps, "pending");

    const result = await login(
      { email: "artist.clara@vtt.test", password: "S3cure!pass" },
      deps,
    );

    expect(result.session.accountId).toBe(account.id);
  });

  it("denies a login racing a concurrent Admin deactivation — the live check inside the SAME lock wins (M3)", async () => {
    const deps = makeDeps();
    const { account, profile } = await seedArtist(deps, "active");
    const admin = actorFor(anAccount("admin"));

    // Both operations are registered against the SAME ProfileUnitOfWork
    // queue WITHOUT awaiting in between — the fake serializes them, so the
    // deactivation (registered first) commits before login's callback ever
    // reads the Profile. Login MUST observe the committed 'deactivated'
    // status and deny, never issue a session from a stale pre-lock read.
    const deactivation = deactivateProfile(
      admin,
      { profileId: profile.id },
      deps,
    );
    const loginAttempt = login(
      { email: "artist.clara@vtt.test", password: "S3cure!pass" },
      deps,
    );

    await expect(deactivation).resolves.toMatchObject({ status: "deactivated" });
    await expect(loginAttempt).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(deps.sessions.sessionsForAccount(account.id)).toHaveLength(0);
  });
});

describe("logout", () => {
  it("revokes exactly the presented session (revokeOne)", async () => {
    const deps = makeDeps();
    const { account } = await seedArtist(deps, "active");
    const first = await login(
      { email: "artist.clara@vtt.test", password: "S3cure!pass" },
      deps,
    );
    const second = await login(
      { email: "artist.clara@vtt.test", password: "S3cure!pass" },
      deps,
    );

    await logout(first.session.id, { sessions: deps.sessions });

    expect(await deps.sessions.resolveValid(first.session.id)).toBeNull();
    expect(await deps.sessions.resolveValid(second.session.id)).not.toBeNull();
    expect(deps.sessions.sessionsForAccount(account.id)).toHaveLength(1);
  });
});
