import { beforeEach, describe, expect, it } from "vitest";
import { login } from "@application/use-cases/login";
import { deactivateProfile } from "@application/use-cases/deactivateProfile";
import type { Actor } from "@application/Actor";
import { UnauthenticatedError } from "@application/errors";
import { createAccount } from "@domain/account/Account";
import { approveProfile, createProfile } from "@domain/profile/Profile";
import { PrismaAccountRepository } from "@infrastructure/persistence/prisma/AccountRepository";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import { PrismaProfileUnitOfWork } from "@infrastructure/persistence/prisma/ProfileUnitOfWork";
import { PrismaLoginRateLimiter } from "@infrastructure/auth/loginRateLimiter";
import { Argon2PasswordHasher } from "@infrastructure/auth/passwordHasher";
import { createDeferred, tick } from "./support/barrier";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";

/**
 * Task 4.22 (M3): barrier-based interleave of `login` and
 * `deactivateProfile` for the SAME Account. `deactivateProfile` holds the
 * Account row lock first (via `afterLock`); `login`'s own
 * `withLockedProfile` call genuinely blocks at the Postgres level until
 * deactivation commits — the login MUST be denied, never issuing a
 * session from a stale pre-lock read (this closes the exact gap pr2a-M1/M3
 * flagged in the application-layer-only test suite).
 */
const dbAvailable = await isDatabaseAvailable();

const adminActor: Actor = { accountId: "admin-account", role: "admin" };
const PASSWORD = "correct-password";

describe.skipIf(!dbAvailable)("race: login vs deactivation (4.22, M3)", () => {
  const client = getTestPrismaClient();
  const passwordHasher = new Argon2PasswordHasher();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("denies a login that arrives after deactivation has locked the Account", async () => {
    const accounts = new PrismaAccountRepository(client);
    const profiles = new PrismaProfileRepository(client);

    const account = createAccount({
      id: "hospital-account",
      email: "hospital@vtt.test",
      role: "hospital",
    });
    await accounts.save({
      account,
      passwordHash: await passwordHasher.hash(PASSWORD),
    });
    const profile = approveProfile(
      createProfile({
        id: "hospital-profile",
        accountId: account.id,
        type: "hospital",
        name: "San Juan Hospital",
      }),
    );
    await profiles.save(profile);

    const deactivateHoldsLock = createDeferred<void>();
    const deactivateLockAcquired = createDeferred<void>();

    const deactivateUoW = new PrismaProfileUnitOfWork(client, {
      afterLock: async () => {
        deactivateLockAcquired.resolve();
        await deactivateHoldsLock.promise;
      },
    });

    const deactivatePromise = deactivateProfile(
      adminActor,
      { profileId: profile.id },
      { profiles, profileUnitOfWork: deactivateUoW },
    );

    await deactivateLockAcquired.promise; // deactivation now holds the Account lock.

    const loginPromise = login(
      { email: account.email, password: PASSWORD },
      {
        accounts,
        passwordHasher,
        rateLimiter: new PrismaLoginRateLimiter(client),
        profileUnitOfWork: new PrismaProfileUnitOfWork(client),
      },
    );

    await tick(); // let login's SELECT ... FOR UPDATE reach Postgres and block.
    deactivateHoldsLock.resolve(); // release deactivation — it commits.

    const [deactivateResult, loginResult] = await Promise.allSettled([
      deactivatePromise,
      loginPromise,
    ]);

    expect(deactivateResult.status).toBe("fulfilled");
    expect(loginResult.status).toBe("rejected");
    expect((loginResult as PromiseRejectedResult).reason).toBeInstanceOf(
      UnauthenticatedError,
    );

    const finalProfile = await client.profile.findUniqueOrThrow({
      where: { id: profile.id },
    });
    expect(finalProfile.status).toBe("DEACTIVATED");

    const liveSessions = await client.session.findMany({
      where: { accountId: account.id },
    });
    expect(liveSessions).toHaveLength(0); // login never created one.
  });
});
