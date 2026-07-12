import { beforeEach, describe, expect, it } from "vitest";
import { registerProfile } from "@application/use-cases/registerProfile";
import { ConflictError } from "@application/errors";
import type { IdGenerator } from "@application/ports/IdGenerator";
import { Argon2PasswordHasher } from "@infrastructure/auth/passwordHasher";
import {
  PrismaRegistrationUnitOfWork,
} from "@infrastructure/persistence/prisma/RegistrationUnitOfWork";
import { CryptoIdGenerator } from "@infrastructure/shared/idGenerator";
import { SystemClock } from "@infrastructure/shared/clock";
import { createDeferred, waitForPostgresLockWait } from "./support/barrier";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import { createHospitalProfile } from "./support/fixtures";

const dbAvailable = await isDatabaseAvailable();

class FixedIdGenerator implements IdGenerator {
  constructor(private readonly ids: string[]) {}

  next(): string {
    const id = this.ids.shift();
    if (!id) throw new Error("FixedIdGenerator ran out of ids");
    return id;
  }
}

describe.skipIf(!dbAvailable)("PrismaRegistrationUnitOfWork (pr2a-M5)", () => {
  const client = getTestPrismaClient();
  const passwordHasher = new Argon2PasswordHasher();
  const clock = new SystemClock();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("serializes two first registrations for the same email and exposes a ConflictError, never a raw database error", async () => {
    const email = "registration-race@vtt.test";
    const firstHoldsLock = createDeferred<void>();
    const firstLockAcquired = createDeferred<void>();

    const firstUow = new PrismaRegistrationUnitOfWork(client, {
      afterLock: async () => {
        firstLockAcquired.resolve();
        await firstHoldsLock.promise;
      },
    });

    const first = registerProfile(
      {
        email,
        password: "S3cure!pass",
        role: "artist",
        name: "First artist",
      },
      {
        registrationUnitOfWork: firstUow,
        passwordHasher,
        idGenerator: new CryptoIdGenerator(),
        clock,
      },
    );

    await firstLockAcquired.promise;

    const second = registerProfile(
      {
        email,
        password: "S3cure!pass",
        role: "artist",
        name: "Second artist",
      },
      {
        registrationUnitOfWork: new PrismaRegistrationUnitOfWork(client),
        passwordHasher,
        idGenerator: new CryptoIdGenerator(),
        clock,
      },
    );

    await waitForPostgresLockWait(client, "advisory");
    firstHoldsLock.resolve();

    const [firstResult, secondResult] = await Promise.allSettled([first, second]);
    expect(firstResult.status).toBe("fulfilled");
    expect(secondResult.status).toBe("rejected");
    expect((secondResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const accounts = await client.account.findMany({ where: { email } });
    expect(accounts).toHaveLength(1);
    const profiles = await client.profile.findMany({ where: { accountId: accounts[0]!.id } });
    expect(profiles).toHaveLength(1);
  });

  it("rolls the Account insert back when the following Profile write fails", async () => {
    const { profile: existingProfile } = await createHospitalProfile(client);
    const email = "profile-write-failure@vtt.test";

    await expect(
      registerProfile(
        {
          email,
          password: "S3cure!pass",
          role: "artist",
          name: "Profile collision",
        },
        {
          registrationUnitOfWork: new PrismaRegistrationUnitOfWork(client),
          passwordHasher,
          // Fresh Account id, then a Profile id that already exists: the
          // Profile INSERT fails with P2002 after the Account INSERT.
          idGenerator: new FixedIdGenerator(["new-registration-account", existingProfile.id]),
          clock,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await client.account.findUnique({ where: { email } })).toBeNull();
    expect(await client.profile.findUnique({ where: { id: existingProfile.id } })).not.toBeNull();
  });
});
