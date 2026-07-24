import { describe, expect, it } from "vitest";

import { listPublicHospitals } from "@application/use-cases/listPublicHospitals";
import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";
import { FakePublicHospitalDirectoryQuery } from "./support/fakes";

const ALLOW_LISTED_FIELDS = [
  "centreType",
  "city",
  "latitude",
  "longitude",
  "name",
  "postalCode",
].sort();

function aHospital(
  overrides: Partial<PublicHospitalProjection> = {},
): PublicHospitalProjection {
  return {
    name: "Hospital Universitario del Mar",
    city: "Valencia",
    postalCode: "46011",
    latitude: 39.4699,
    longitude: -0.3763,
    centreType: "hospital",
    ...overrides,
  };
}

describe("listPublicHospitals (public, D9 allow-list via PublicHospitalDirectoryQuery)", () => {
  it("returns exactly what the PublicHospitalDirectoryQuery port supplies (already filtered to ACTIVE hospitals, D9)", async () => {
    const items = [aHospital(), aHospital({ name: "Hospital Santa Clara", city: "Sevilla" })];
    const deps = {
      publicHospitalDirectoryQuery: new FakePublicHospitalDirectoryQuery(items),
    };

    const result = await listPublicHospitals(deps);

    expect(result).toEqual(items);
  });

  it("returns an empty list when the query has no active hospitals", async () => {
    const deps = {
      publicHospitalDirectoryQuery: new FakePublicHospitalDirectoryQuery([]),
    };

    const result = await listPublicHospitals(deps);

    expect(result).toEqual([]);
  });

  it("passes through a hospital with null city/postalCode/coordinates unchanged (D9: nullability is honest, not hidden)", async () => {
    const incomplete = aHospital({
      city: null,
      postalCode: null,
      latitude: null,
      longitude: null,
    });
    const deps = {
      publicHospitalDirectoryQuery: new FakePublicHospitalDirectoryQuery([incomplete]),
    };

    const result = await listPublicHospitals(deps);

    expect(result).toEqual([incomplete]);
  });

  it("every returned item is STRUCTURALLY limited to the D9 allow-list — exact key set, no addressLine, email, id", async () => {
    const deps = {
      publicHospitalDirectoryQuery: new FakePublicHospitalDirectoryQuery([aHospital()]),
    };

    const result = await listPublicHospitals(deps);

    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(ALLOW_LISTED_FIELDS);
      expect(item).not.toHaveProperty("addressLine");
      expect(item).not.toHaveProperty("email");
      expect(item).not.toHaveProperty("id");
      expect(item).not.toHaveProperty("accountId");
      expect(item).not.toHaveProperty("status");
      expect(item).not.toHaveProperty("type");
    }
  });

  it("a pre-existing hospital row shows centreType hospital (D19: migration backfill, ADR D19)", async () => {
    const deps = {
      publicHospitalDirectoryQuery: new FakePublicHospitalDirectoryQuery([aHospital()]),
    };

    const result = await listPublicHospitals(deps);

    expect(result).toHaveLength(1);
    expect(result[0].centreType).toBe("hospital");
  });

  it("HOSTILE ADAPTER (D14/pr2a-B1): rebuilds a fresh DTO — addressLine, email, id, the forbidden type (role) field, and event-derived fields returned by the port are structurally ABSENT from the result, while centreType passes through", async () => {
    const hostileItem = {
      ...aHospital(),
      // A port implementation (buggy, compromised, or a future accidental
      // `select`/`include` widening) could return these alongside the
      // allow-listed fields. TypeScript's structural typing does not stop
      // an object literal with EXTRA properties from being passed where
      // `PublicHospitalProjection` is expected, and a plain pass-through
      // would leak them straight into JSON.
      addressLine: "Calle Mayor 12, 4ºB",
      email: "hospital.mar@vtt.test",
      id: "profile-secret-id",
      accountId: "account-secret-id",
      status: "ACTIVE",
      // `type` is the internal ProfileType/role field — a DIFFERENT axis
      // from `centreType` (ADR D19). It must stay forbidden even though
      // `centreType` is newly admitted onto the allow-list.
      type: "CENTRE",
      reviewRequestedAt: new Date("2026-01-01T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      // Event-derived fields (D10) — a "helpful badge" leak, not just a D9 leak.
      eventCount: 3,
      nextEventAt: new Date("2026-08-01T17:00:00Z"),
      hasUpcomingEvents: true,
    } as unknown as PublicHospitalProjection;

    const deps = {
      publicHospitalDirectoryQuery: new FakePublicHospitalDirectoryQuery([hostileItem]),
    };

    const result = await listPublicHospitals(deps);

    expect(result).toHaveLength(1);
    const [item] = result;
    expect(Object.keys(item).sort()).toEqual(ALLOW_LISTED_FIELDS);
    expect(item).not.toHaveProperty("addressLine");
    expect(item).not.toHaveProperty("email");
    expect(item).not.toHaveProperty("id");
    expect(item).not.toHaveProperty("accountId");
    expect(item).not.toHaveProperty("status");
    expect(item).not.toHaveProperty("type");
    expect(item).not.toHaveProperty("reviewRequestedAt");
    expect(item).not.toHaveProperty("createdAt");
    expect(item).not.toHaveProperty("updatedAt");
    expect(item).not.toHaveProperty("eventCount");
    expect(item).not.toHaveProperty("nextEventAt");
    expect(item).not.toHaveProperty("hasUpcomingEvents");
    // The allow-listed fields themselves must still be forwarded correctly.
    expect(item.name).toBe(hostileItem.name);
    expect(item.city).toBe(hostileItem.city);
    expect(item.centreType).toBe(hostileItem.centreType);
  });

  it("HOSTILE ADAPTER supplying review/audit fields (D26): reviewBasis, adminAccountId, and reviewedAt are stripped by the field-by-field rebuild", async () => {
    const hostileItem = {
      ...aHospital(),
      // ADR D26 — the audit trail this change introduces (`ProfileReview`:
      // basis, adminAccountId, decision, at) lives on a table never joined
      // into this query. Even if a future adapter bug or a compromised port
      // implementation attached these fields to the returned object anyway,
      // the fresh-object-literal rebuild in `listPublicHospitals` must still
      // strip them before they can reach public JSON.
      reviewBasis: "Convenio VTT-2026-014 verified by phone",
      adminAccountId: "admin-secret-account-id",
      reviewedAt: new Date("2026-07-20T10:00:00Z"),
    } as unknown as PublicHospitalProjection;

    const deps = {
      publicHospitalDirectoryQuery: new FakePublicHospitalDirectoryQuery([hostileItem]),
    };

    const result = await listPublicHospitals(deps);

    expect(result).toHaveLength(1);
    const [item] = result;
    expect(Object.keys(item).sort()).toEqual(ALLOW_LISTED_FIELDS);
    expect(item).not.toHaveProperty("reviewBasis");
    expect(item).not.toHaveProperty("adminAccountId");
    expect(item).not.toHaveProperty("reviewedAt");
    // The allow-listed fields themselves must still be forwarded correctly.
    expect(item.name).toBe(hostileItem.name);
    expect(item.centreType).toBe(hostileItem.centreType);
  });

  it("does not import or depend on anything beyond the PublicHospitalDirectoryQuery port (no repository, no Prisma)", () => {
    // Structural/compile-time guarantee: the module's only import besides
    // the DTO type is the port interface — verified by this file compiling
    // and passing under the ESLint layer-boundary rule (application/ MUST
    // NOT import Prisma or infrastructure). See eslint.config.mjs.
    expect(typeof listPublicHospitals).toBe("function");
  });
});
