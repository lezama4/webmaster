import { describe, expect, it } from "vitest";

import { DomainValidationError } from "@domain/errors";
import { ConflictError, ForbiddenError, UnauthenticatedError } from "@application/errors";
import { registerProfile } from "@application/use-cases/registerProfile";
import {
  FakePasswordHasher,
  FakeRegistrationUnitOfWork,
  fixedClock,
  InMemoryAccountRepository,
  InMemoryProfileRepository,
  SequentialIdGenerator,
} from "./support/fakes";
import { aProfile, anAccount } from "./support/builders";

function makeDeps() {
  const accounts = new InMemoryAccountRepository();
  const profiles = new InMemoryProfileRepository();
  return {
    accounts,
    profiles,
    registrationUnitOfWork: new FakeRegistrationUnitOfWork(accounts, profiles),
    passwordHasher: new FakePasswordHasher(),
    idGenerator: new SequentialIdGenerator(),
    clock: fixedClock,
  };
}

describe("registerProfile (self-registration -> pending Profile)", () => {
  it("registers a Hospital: creates the account and a 'pending' hospital profile", async () => {
    const deps = makeDeps();

    const profile = await registerProfile(
      {
        email: "hospital.sanjuan@vtt.test",
        password: "S3cure!pass",
        role: "hospital",
        name: "Hospital San Juan",
      },
      deps,
    );

    expect(profile.status).toBe("pending");
    expect(profile.type).toBe("hospital");
    expect(profile.name).toBe("Hospital San Juan");

    const record = await deps.accounts.findByEmail("hospital.sanjuan@vtt.test");
    expect(record).not.toBeNull();
    expect(record!.account.role).toBe("hospital");
    expect(profile.accountId).toBe(record!.account.id);

    const persisted = await deps.profiles.findByAccountId(record!.account.id);
    expect(persisted?.status).toBe("pending");
  });

  it("registers an Artist: creates a 'pending' artist profile", async () => {
    const deps = makeDeps();

    const profile = await registerProfile(
      {
        email: "artist.clara@vtt.test",
        password: "S3cure!pass",
        role: "artist",
        name: "Clara",
      },
      deps,
    );

    expect(profile.status).toBe("pending");
    expect(profile.type).toBe("artist");
  });

  it("stores a password HASH, never the plaintext", async () => {
    const deps = makeDeps();

    await registerProfile(
      {
        email: "artist.clara@vtt.test",
        password: "S3cure!pass",
        role: "artist",
        name: "Clara",
      },
      deps,
    );

    const record = await deps.accounts.findByEmail("artist.clara@vtt.test");
    expect(record!.passwordHash).toBe("hashed:S3cure!pass");
    expect(record!.passwordHash).not.toContain("S3cure!pass "); // sanity
    expect(record!.passwordHash.startsWith("hashed:")).toBe(true);
  });

  it("denies self-registration for the admin role", async () => {
    const deps = makeDeps();

    await expect(
      registerProfile(
        {
          email: "admin@vtt.test",
          password: "S3cure!pass",
          role: "admin",
          name: "Admin",
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("denies self-registration for the patient role", async () => {
    const deps = makeDeps();

    await expect(
      registerProfile(
        {
          email: "patient.ana@vtt.test",
          password: "S3cure!pass",
          role: "patient",
          name: "Ana",
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("reactivates a 'rejected' profile on re-registration WITH THE CORRECT PASSWORD: SAME Profile row, rejected -> pending (M2)", async () => {
    const deps = makeDeps();
    const account = anAccount("artist", { email: "artist.clara@vtt.test" });
    await deps.accounts.save({ account, passwordHash: "hashed:S3cure!pass" });
    const rejected = aProfile("artist", "rejected", { accountId: account.id });
    await deps.profiles.save(rejected);

    const result = await registerProfile(
      {
        email: "artist.clara@vtt.test",
        password: "S3cure!pass",
        role: "artist",
        name: "Clara",
      },
      deps,
    );

    expect(result.id).toBe(rejected.id); // SAME Profile row, not a new one
    expect(result.status).toBe("pending");
    expect(result.reviewRequestedAt).toEqual(fixedClock.now());

    const persisted = await deps.profiles.findByAccountId(account.id);
    expect(persisted?.id).toBe(rejected.id);
    expect(persisted?.status).toBe("pending");
  });

  it("pr2a-B2 (BLOCKER): denies re-registration with the WRONG password — never reactivates on email alone", async () => {
    const deps = makeDeps();
    const account = anAccount("artist", { email: "artist.clara@vtt.test" });
    await deps.accounts.save({ account, passwordHash: "hashed:S3cure!pass" });
    const rejected = aProfile("artist", "rejected", { accountId: account.id });
    await deps.profiles.save(rejected);

    await expect(
      registerProfile(
        {
          email: "artist.clara@vtt.test",
          password: "totally-wrong-password",
          role: "artist",
          name: "Clara",
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(UnauthenticatedError);

    // No state change: still rejected, no forged review request.
    const persisted = await deps.profiles.findByAccountId(account.id);
    expect(persisted?.status).toBe("rejected");
    expect(persisted?.reviewRequestedAt).toBeUndefined();
  });

  it("pr2a-B2 (BLOCKER): denies re-registration when the requested role does not match the stored Account role", async () => {
    const deps = makeDeps();
    // Account is registered as 'artist'; caller now claims 'hospital' for the same email.
    const account = anAccount("artist", { email: "shared@vtt.test" });
    await deps.accounts.save({ account, passwordHash: "hashed:S3cure!pass" });
    const rejected = aProfile("artist", "rejected", { accountId: account.id });
    await deps.profiles.save(rejected);

    await expect(
      registerProfile(
        {
          email: "shared@vtt.test",
          password: "S3cure!pass", // CORRECT password — role mismatch alone must still deny.
          role: "hospital",
          name: "Some Hospital",
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const persisted = await deps.profiles.findByAccountId(account.id);
    expect(persisted?.status).toBe("rejected"); // unchanged
  });

  it("pr2a-B2: creates a Profile for an existing Account with none, but ONLY after verifying the password", async () => {
    const deps = makeDeps();
    const account = anAccount("artist", { email: "profileless@vtt.test" });
    await deps.accounts.save({ account, passwordHash: "hashed:S3cure!pass" });
    // Deliberately no Profile saved for this account (D2: unexpected but harmless).

    await expect(
      registerProfile(
        {
          email: "profileless@vtt.test",
          password: "wrong-password",
          role: "artist",
          name: "Clara",
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(await deps.profiles.findByAccountId(account.id)).toBeNull();

    const profile = await registerProfile(
      {
        email: "profileless@vtt.test",
        password: "S3cure!pass",
        role: "artist",
        name: "Clara",
      },
      deps,
    );
    expect(profile.status).toBe("pending");
    expect(profile.accountId).toBe(account.id);
  });

  it("rejects a duplicate registration while the existing profile is not 'rejected'", async () => {
    const deps = makeDeps();
    const account = anAccount("artist", { email: "artist.clara@vtt.test" });
    await deps.accounts.save({ account, passwordHash: "hashed:S3cure!pass" });
    await deps.profiles.save(
      aProfile("artist", "pending", { accountId: account.id }),
    );

    await expect(
      registerProfile(
        {
          email: "artist.clara@vtt.test",
          password: "S3cure!pass",
          role: "artist",
          name: "Clara",
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("pr2a-M5/B2: concurrent registration for the SAME new email leaves one Account/Profile and rejects an unverified second caller", async () => {
    const deps = makeDeps();

    const first = registerProfile(
      {
        email: "race@vtt.test",
        password: "S3cure!pass",
        role: "artist",
        name: "First Caller",
      },
      deps,
    );
    const second = registerProfile(
      {
        email: "race@vtt.test",
        password: "Different!pass",
        role: "artist",
        name: "Second Caller",
      },
      deps,
    );

    const results = await Promise.allSettled([first, second]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // The second caller reaches the now-existing Account after the first
    // transaction commits. Because it supplied a different password, the
    // credential-verified re-registration rule (pr2a-B2) correctly rejects
    // it as unauthenticated rather than disclosing lifecycle detail via a
    // ConflictError.
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      UnauthenticatedError,
    );

    // Exactly ONE Account exists for the email — the queue-serialized unit
    // of work never let both callers create separate Accounts.
    const record = await deps.accounts.findByEmail("race@vtt.test");
    expect(record).not.toBeNull();
    const profile = await deps.profiles.findByAccountId(record!.account.id);
    expect(profile).not.toBeNull();
  });

  it("pr2a-M5: leaves NO orphan Account when the Profile save fails mid-registration (atomicity)", async () => {
    const accounts = new InMemoryAccountRepository();
    const profiles = new InMemoryProfileRepository();
    class ThrowingProfileRepository extends InMemoryProfileRepository {
      async save(): Promise<never> {
        throw new Error("simulated Profile save failure");
      }
    }
    const failingUow = new FakeRegistrationUnitOfWork(
      accounts,
      new ThrowingProfileRepository(),
    );
    const deps = {
      accounts,
      profiles,
      registrationUnitOfWork: failingUow,
      passwordHasher: new FakePasswordHasher(),
      idGenerator: new SequentialIdGenerator(),
      clock: fixedClock,
    };

    await expect(
      registerProfile(
        {
          email: "atomic@vtt.test",
          password: "S3cure!pass",
          role: "artist",
          name: "Clara",
        },
        deps,
      ),
    ).rejects.toThrow("simulated Profile save failure");

    // NO partial state: the Account write rolled back alongside the failed
    // Profile write — no orphan Account survives.
    expect(await accounts.findByEmail("atomic@vtt.test")).toBeNull();
  });

  describe("hospital public location (Phase 2 — optional, hospital-only)", () => {
    it("persists the optional public location for a Hospital registration", async () => {
      const deps = makeDeps();

      const profile = await registerProfile(
        {
          email: "hospital.sanjuan@vtt.test",
          password: "S3cure!pass",
          role: "hospital",
          name: "Hospital San Juan",
          city: "Bilbao",
          postalCode: "48013",
          addressLine: "Plaza de Cruces, 12",
          latitude: 43.263,
          longitude: -2.935,
        },
        deps,
      );

      expect(profile.city).toBe("Bilbao");
      expect(profile.postalCode).toBe("48013");
      expect(profile.addressLine).toBe("Plaza de Cruces, 12");
      expect(profile.latitude).toBe(43.263);
      expect(profile.longitude).toBe(-2.935);

      const persisted = await deps.profiles.findByAccountId(
        (await deps.accounts.findByEmail("hospital.sanjuan@vtt.test"))!.account.id,
      );
      expect(persisted?.city).toBe("Bilbao");
    });

    it("registers a Hospital with NO location fields — none are required", async () => {
      const deps = makeDeps();

      const profile = await registerProfile(
        {
          email: "hospital.sanjuan@vtt.test",
          password: "S3cure!pass",
          role: "hospital",
          name: "Hospital San Juan",
        },
        deps,
      );

      expect(profile.status).toBe("pending");
      expect(profile.city).toBeUndefined();
      expect(profile.latitude).toBeUndefined();
    });

    it("ignores location fields for an Artist registration (location is hospital-only)", async () => {
      const deps = makeDeps();

      const profile = await registerProfile(
        {
          email: "artist.clara@vtt.test",
          password: "S3cure!pass",
          role: "artist",
          name: "Clara",
          city: "Bilbao",
          latitude: 43.263,
          longitude: -2.935,
        },
        deps,
      );

      expect(profile.city).toBeUndefined();
      expect(profile.latitude).toBeUndefined();
      expect(profile.longitude).toBeUndefined();
    });

    it("propagates a DomainValidationError for an out-of-range latitude on a Hospital registration", async () => {
      const deps = makeDeps();

      await expect(
        registerProfile(
          {
            email: "hospital.sanjuan@vtt.test",
            password: "S3cure!pass",
            role: "hospital",
            name: "Hospital San Juan",
            latitude: 200,
            longitude: 0,
          },
          deps,
        ),
      ).rejects.toBeInstanceOf(DomainValidationError);
    });
  });
});
