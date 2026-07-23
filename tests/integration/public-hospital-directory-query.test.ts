import { beforeEach, describe, expect, it } from "vitest";
import { createAccount } from "@domain/account/Account";
import {
  approveProfile,
  CENTRE_TYPES,
  createProfile,
  deactivateProfile,
  rejectProfile,
  type CentreType,
} from "@domain/profile/Profile";
import { PrismaAccountRepository } from "@infrastructure/persistence/prisma/AccountRepository";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import { PrismaPublicHospitalDirectoryQuery } from "@infrastructure/persistence/prisma/PublicHospitalDirectoryQuery";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";

/**
 * Phase 3.1 (ADR D9/D10) — asserts the real Prisma adapter against real
 * Postgres. Also resolves the open runtime half of Phase 0.1: the design's
 * UNVERIFIED assumption that `orderBy: [{ city: { sort: "asc", nulls:
 * "last" } }, { name: "asc" }]` executes correctly against a mix of
 * null/non-null `city` rows was, until this file, only confirmed to
 * type-check (PR1). The "orders active hospitals..." test below is the
 * authority for that runtime half.
 */
const dbAvailable = await isDatabaseAvailable();

let profileCounter = 0;
function nextId(prefix: string): string {
  profileCounter += 1;
  return `${prefix}-${Date.now()}-${profileCounter}`;
}

interface SeedHospitalInput {
  readonly name: string;
  readonly status: "pending" | "active";
  readonly centreType?: CentreType;
  readonly city?: string;
  readonly postalCode?: string;
  readonly addressLine?: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

describe.skipIf(!dbAvailable)("PrismaPublicHospitalDirectoryQuery (3.1)", () => {
  const client = getTestPrismaClient();
  const accounts = new PrismaAccountRepository(client);
  const profiles = new PrismaProfileRepository(client);

  beforeEach(async () => {
    await resetDatabase(client);
  });

  async function seedHospital(input: SeedHospitalInput) {
    const accountId = nextId("account-hospital");
    const profileId = nextId("profile-hospital");
    await accounts.save({
      account: createAccount({
        id: accountId,
        email: `${nextId("hospital")}@vtt.test`,
        role: "centre",
      }),
      passwordHash: "unused-in-integration-test",
    });

    let profile = createProfile({
      id: profileId,
      accountId,
      type: "centre",
      centreType: input.centreType ?? "hospital",
      name: input.name,
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
      ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    });

    if (input.status === "active") {
      profile = approveProfile(profile);
    }

    await profiles.save(profile);
    return { accountId, profileId };
  }

  async function seedArtist(name: string) {
    const accountId = nextId("account-artist");
    await accounts.save({
      account: createAccount({
        id: accountId,
        email: `${nextId("artist")}@vtt.test`,
        role: "artist",
      }),
      passwordHash: "unused-in-integration-test",
    });
    const profile = approveProfile(
      createProfile({
        id: nextId("profile-artist"),
        accountId,
        type: "artist",
        name,
      }),
    );
    await profiles.save(profile);
  }

  it("returns only ACTIVE Hospital profiles, excluding PENDING/REJECTED/DEACTIVATED/Artist", async () => {
    await seedHospital({
      name: "Hospital San Juan",
      status: "active",
      city: "Bilbao",
      postalCode: "48013",
      addressLine: "Plaza de Cruces, 12",
      latitude: 43.263,
      longitude: -2.935,
    });
    await seedHospital({ name: "Hospital Esperanza", status: "pending" });

    const rejectedAccountId = nextId("account-hospital");
    await accounts.save({
      account: createAccount({
        id: rejectedAccountId,
        email: `${nextId("hospital")}@vtt.test`,
        role: "centre",
      }),
      passwordHash: "unused-in-integration-test",
    });
    const rejected = rejectProfile(
      createProfile({
        id: nextId("profile-hospital"),
        accountId: rejectedAccountId,
        type: "centre",
        centreType: "hospital",
        name: "Hospital Rechazado",
      }),
    );
    await profiles.save(rejected);

    const deactivatedAccountId = nextId("account-hospital");
    await accounts.save({
      account: createAccount({
        id: deactivatedAccountId,
        email: `${nextId("hospital")}@vtt.test`,
        role: "centre",
      }),
      passwordHash: "unused-in-integration-test",
    });
    const deactivated = deactivateProfile(
      approveProfile(
        createProfile({
          id: nextId("profile-hospital"),
          accountId: deactivatedAccountId,
          type: "centre",
          centreType: "hospital",
          name: "Hospital Desactivado",
        }),
      ),
    );
    await profiles.save(deactivated);

    await seedArtist("Clara the Artist");

    const query = new PrismaPublicHospitalDirectoryQuery(client);
    const results = await query.listActive();

    expect(results.map((r) => r.name)).toEqual(["Hospital San Juan"]);
  });

  it("exposes exactly the 6 allow-listed keys (incl. centreType), with `addressLine`/`type` absent from the raw result (D19)", async () => {
    await seedHospital({
      name: "Hospital San Juan",
      status: "active",
      centreType: "hospital",
      city: "Bilbao",
      postalCode: "48013",
      addressLine: "Plaza de Cruces, 12",
      latitude: 43.263,
      longitude: -2.935,
    });

    const query = new PrismaPublicHospitalDirectoryQuery(client);
    const results = await query.listActive();

    expect(results).toHaveLength(1);
    const projection = results[0]!;
    expect(Object.keys(projection).sort()).toEqual(
      ["centreType", "city", "latitude", "longitude", "name", "postalCode"].sort(),
    );
    expect(projection.centreType).toBe("hospital");
    expect(JSON.stringify(projection)).not.toContain("Plaza de Cruces");
    expect(JSON.stringify(projection)).not.toContain("addressLine");
    expect(JSON.stringify(projection)).not.toContain('"type"');
  });

  it("orders active hospitals by city asc (nulls last), then name asc — real Postgres runtime check (resolves Phase 0.1)", async () => {
    await seedHospital({ name: "Hospital Zaragoza", status: "active", city: "Zaragoza" });
    await seedHospital({ name: "Hospital Alicante", status: "active", city: "Alicante" });
    await seedHospital({ name: "Hospital Sin Ciudad B", status: "active" });
    await seedHospital({ name: "Hospital Sin Ciudad A", status: "active" });
    await seedHospital({ name: "Hospital Bilbao", status: "active", city: "Bilbao" });

    const query = new PrismaPublicHospitalDirectoryQuery(client);
    const results = await query.listActive();

    expect(results.map((r) => r.name)).toEqual([
      "Hospital Alicante",
      "Hospital Bilbao",
      "Hospital Zaragoza",
      "Hospital Sin Ciudad A",
      "Hospital Sin Ciudad B",
    ]);
  });

  it("both hospital with events and hospital without look identical in shape (D10)", async () => {
    // Non-correlation, hospital-directory side: the query never joins Slot/
    // Proposal/Event, so shape identity holds trivially by construction —
    // asserted here as a runtime regression guard, not merely a type claim.
    await seedHospital({ name: "Hospital Con Actividad", status: "active", city: "Madrid" });
    await seedHospital({ name: "Hospital Sin Actividad", status: "active", city: "Madrid" });

    const query = new PrismaPublicHospitalDirectoryQuery(client);
    const results = await query.listActive();

    expect(results).toHaveLength(2);
    const keySets = results.map((r) => Object.keys(r).sort().join(","));
    expect(new Set(keySets).size).toBe(1);
  });

  it("returns hospitals across multiple cities and postal codes for search demonstration (4.4)", async () => {
    await seedHospital({
      name: "Hospital Universitario del Mar",
      status: "active",
      city: "Valencia",
      postalCode: "46011",
      addressLine: "Avenida del Mar, 45",
      latitude: 39.4699,
      longitude: -0.3763,
    });
    await seedHospital({
      name: "Hospital Santa Clara",
      status: "active",
      city: "Sevilla",
      postalCode: "41003",
      addressLine: "Calle Santa Clara, 8",
      latitude: 37.3891,
      longitude: -5.9845,
    });
    await seedHospital({
      name: "Hospital San Rafael",
      status: "active",
      city: "Zaragoza",
      postalCode: "50009",
      addressLine: "Paseo San Rafael, 33",
      latitude: 41.6488,
      longitude: -0.8891,
    });
    await seedHospital({
      name: "Hospital San Juan",
      status: "active",
      city: "Bilbao",
      postalCode: "48013",
      addressLine: "Plaza de Cruces, 12",
      latitude: 43.263,
      longitude: -2.935,
    });
    await seedHospital({ name: "Hospital Esperanza", status: "pending" });

    const query = new PrismaPublicHospitalDirectoryQuery(client);
    const results = await query.listActive();

    expect(results.length).toBeGreaterThanOrEqual(4);
    expect(new Set(results.map((r) => r.city)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(results.map((r) => r.postalCode)).size).toBeGreaterThanOrEqual(3);
    expect(results.some((r) => r.name === "Hospital Esperanza")).toBe(false);
  });

  it("returns all six centreType values for distinct active centres, excluding a PENDING one of an arbitrary type (4.4, D19)", async () => {
    // public-hospital-directory spec: "Seed produces all six centre types,
    // demonstrably filterable" — proves the widened predicate/select against
    // real Postgres, independent of `prisma/seed.ts`'s own diversified rows.
    for (const centreType of CENTRE_TYPES) {
      await seedHospital({
        name: `Centro ${centreType}`,
        status: "active",
        centreType,
        city: `Ciudad ${centreType}`,
        postalCode: "00000",
      });
    }
    // A PENDING centre of an arbitrary (non-hospital) type must still never
    // appear — the security predicate is `type: CENTRE` + `status: ACTIVE`,
    // never conditioned on `centreType`.
    await seedHospital({
      name: "Centro Pendiente",
      status: "pending",
      centreType: "palliative_unit",
    });

    const query = new PrismaPublicHospitalDirectoryQuery(client);
    const results = await query.listActive();

    const returnedTypes = new Set(results.map((r) => r.centreType));
    for (const centreType of CENTRE_TYPES) {
      expect(returnedTypes.has(centreType), `missing centreType "${centreType}"`).toBe(true);
    }
    expect(results.some((r) => r.name === "Centro Pendiente")).toBe(false);
  });

  it("seed upsert-by-fixed-id is idempotent (4.3): saving the same hospital Profile id twice never duplicates the row", async () => {
    // `prisma/seed.ts`'s idempotency (spec: "Seed script is idempotent")
    // rests entirely on `PrismaProfileRepository.save` being an upsert
    // keyed by the profile's fixed id (design's Seed Extension section).
    // `prisma/seed.ts` itself is NOT invoked here: its top-level
    // `main().then(...)` runs a real seeding side effect on module import
    // (see `e2e/support/helpers.ts`'s SEED_USERS comment), so importing it
    // from a test — twice, against a database this suite just reset — would
    // be unsafe. This test instead exercises the real mechanism directly.
    const accountId = nextId("account-hospital");
    const fixedProfileId = "seed-idempotency-check-profile";
    await accounts.save({
      account: createAccount({
        id: accountId,
        email: `${nextId("hospital")}@vtt.test`,
        role: "centre",
      }),
      passwordHash: "unused-in-integration-test",
    });

    const hospital = approveProfile(
      createProfile({
        id: fixedProfileId,
        accountId,
        type: "centre",
        centreType: "hospital",
        name: "Hospital Idempotency Check",
        city: "Valencia",
      }),
    );

    try {
      await profiles.save(hospital);
      await profiles.save(hospital);
      await profiles.save(hospital);

      const rows = await client.profile.findMany({ where: { id: fixedProfileId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe("Hospital Idempotency Check");
    } finally {
      // This is the ONLY test in the file whose fixture data survives past
      // its own run: every other test's rows are wiped by the NEXT test's
      // `beforeEach(resetDatabase)`, but this is the last test declared in
      // the file, so nothing resets after it. Against the shared Neon `dev`
      // branch that meant an ACTIVE "Hospital Idempotency Check" profile
      // (with no coordinates/postalCode) persisted indefinitely and leaked
      // into the real public hospital directory UI. Clean up explicitly, in
      // a `finally` so it still runs if an assertion above throws — do not
      // rely on suite ordering or on a future test being added after this
      // one.
      await client.profile.deleteMany({ where: { id: fixedProfileId } });
      await client.account.deleteMany({ where: { id: accountId } });
    }
  });
});
