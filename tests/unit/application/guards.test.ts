import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@application/errors";
import type { Actor } from "@application/Actor";
import { assertActiveProfile, assertRole } from "@application/use-cases/shared/guards";
import { aProfile, anAccount, actorFor } from "./support/builders";

/**
 * D18 authorization invariant, dedicated file (task 2.5/2.6 — did not exist
 * before this change; no pre-existing home to extend). Every centre-only
 * guard (`assertRole`, `assertActiveProfile`) authorizes on `role`/`type`
 * ALONE — `centreType` is an orthogonal data axis it must never read,
 * branch on, or be affected by (centre-registration spec "Authorization
 * Checks Only the Centre Role, Never centreType"). This is what makes "the
 * seventh centre type is data, not code" (D16) true at the authorization
 * layer, not just in the domain model.
 */
describe("Guards authorize by role/type only — never by centreType (D18)", () => {
  it("assertActiveProfile authorises two ACTIVE centre profiles with different centreType values identically", () => {
    const hospital = aProfile("centre", "active", { centreType: "hospital" });
    const dayCentre = aProfile("centre", "active", { centreType: "day_centre" });

    expect(assertActiveProfile(hospital, "centre")).toBe(hospital);
    expect(assertActiveProfile(dayCentre, "centre")).toBe(dayCentre);
  });

  it("assertActiveProfile authorises every one of the six centreType values identically", () => {
    const centreTypes = [
      "hospital",
      "nursing_home",
      "day_centre",
      "day_hospital",
      "occupational_centre",
      "palliative_unit",
    ] as const;

    for (const centreType of centreTypes) {
      const profile = aProfile("centre", "active", { centreType });
      expect(assertActiveProfile(profile, "centre")).toBe(profile);
    }
  });

  it("assertRole authorises a 'centre' Actor regardless of any centreType-shaped property attached to it (hostile/manipulated context)", () => {
    const account = anAccount("centre");
    const actor = actorFor(account);
    // Simulates a manipulated request context carrying an arbitrary/unknown
    // `centreType`-shaped extra property on the Actor — `assertRole` MUST
    // NOT read it; the domain `Actor` type has no such field at all.
    const manipulatedActor = {
      ...actor,
      centreType: "palliative_unit",
    } as unknown as Actor;

    expect(() => assertRole(manipulatedActor, "centre")).not.toThrow();
    expect(() => assertRole(actor, "centre")).not.toThrow();
  });

  it("an unknown/manipulated centreType value cannot turn a denial into an authorization, or vice versa", () => {
    const artistAccount = anAccount("artist");
    const artistActor = actorFor(artistAccount);
    const manipulatedArtistActor = {
      ...artistActor,
      centreType: "hospital", // an Artist actor claiming a centreType — still just noise to the guard
    } as unknown as Actor;

    // Still denied: the guard only ever consulted `role`, and `role` here is 'artist'.
    expect(() => assertRole(manipulatedArtistActor, "centre")).toThrow(ForbiddenError);
  });

  it("assertActiveProfile denies a non-active centre profile regardless of its centreType", () => {
    const pendingPalliative = aProfile("centre", "pending", {
      centreType: "palliative_unit",
    });

    expect(() => assertActiveProfile(pendingPalliative, "centre")).toThrow(
      ForbiddenError,
    );
  });
});
