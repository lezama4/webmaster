import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@application/errors";
import { listPendingProfiles } from "@application/use-cases/listPendingProfiles";
import type { PendingProfileView } from "@application/dto/PendingProfileView";
import { FakePendingProfileQuery } from "./support/fakes";
import { actorFor, anAccount } from "./support/builders";

const ALLOW_LISTED_FIELDS = ["displayName", "profileId", "requestedAt", "type"].sort();

function aPendingProfileView(
  overrides: Partial<PendingProfileView> = {},
): PendingProfileView {
  return {
    profileId: overrides.profileId ?? "profile-1",
    type: overrides.type ?? "centre",
    displayName: overrides.displayName ?? "Hospital San Juan",
    requestedAt: overrides.requestedAt ?? new Date("2026-07-01T10:00:00Z"),
  };
}

const admin = actorFor(anAccount("admin"));

describe("listPendingProfiles (Admin validation queue, 5.3/5.12)", () => {
  it("returns exactly what the PendingProfileQuery port supplies (already ordered oldest-first by the adapter)", async () => {
    const items = [
      aPendingProfileView({ profileId: "profile-1" }),
      aPendingProfileView({ profileId: "profile-2" }),
    ];
    const deps = { pendingProfileQuery: new FakePendingProfileQuery(items) };

    const result = await listPendingProfiles(admin, deps);

    expect(result).toEqual(items);
  });

  it("returns an empty list when there is no pending Profile", async () => {
    const deps = { pendingProfileQuery: new FakePendingProfileQuery([]) };

    const result = await listPendingProfiles(admin, deps);

    expect(result).toEqual([]);
  });

  it("denies a non-admin actor (Hospital) with ForbiddenError", async () => {
    const deps = { pendingProfileQuery: new FakePendingProfileQuery([]) };
    const hospitalActor = actorFor(anAccount("centre"));

    await expect(listPendingProfiles(hospitalActor, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("denies an unauthenticated/anonymous-shaped actor (Patient)", async () => {
    const deps = { pendingProfileQuery: new FakePendingProfileQuery([]) };
    const patient = actorFor(anAccount("patient"));

    await expect(listPendingProfiles(patient, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("every returned item is STRUCTURALLY limited to the allow-list — no accountId, email, or passwordHash", async () => {
    const deps = {
      pendingProfileQuery: new FakePendingProfileQuery([aPendingProfileView()]),
    };

    const result = await listPendingProfiles(admin, deps);

    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(ALLOW_LISTED_FIELDS);
      expect(item).not.toHaveProperty("accountId");
      expect(item).not.toHaveProperty("email");
      expect(item).not.toHaveProperty("passwordHash");
      expect(item).not.toHaveProperty("status");
    }
  });

  it("HOSTILE ADAPTER: rebuilds a fresh DTO — forbidden fields returned by the port are structurally ABSENT from the result", async () => {
    const hostileItem = {
      ...aPendingProfileView(),
      accountId: "account-secret-id",
      email: "hospital@vtt.test",
      passwordHash: "argon2id$secret",
      status: "pending",
    } as unknown as PendingProfileView;
    const deps = {
      pendingProfileQuery: new FakePendingProfileQuery([hostileItem]),
    };

    const result = await listPendingProfiles(admin, deps);

    expect(result).toHaveLength(1);
    const [item] = result;
    expect(Object.keys(item).sort()).toEqual(ALLOW_LISTED_FIELDS);
    expect(item).not.toHaveProperty("accountId");
    expect(item).not.toHaveProperty("email");
    expect(item).not.toHaveProperty("passwordHash");
    expect(item).not.toHaveProperty("status");
    expect(item.profileId).toBe(hostileItem.profileId);
    expect(item.displayName).toBe(hostileItem.displayName);
  });
});
