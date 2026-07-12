import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@application/errors";
import { listOpenSlots } from "@application/use-cases/listOpenSlots";
import type {
  OpenSlotListingItem,
  OpenSlotListingQuery,
} from "@application/ports/OpenSlotListingQuery";
import {
  fixedClock,
  FakeOpenSlotListingQuery,
  InMemoryProfileRepository,
  NOW,
} from "./support/fakes";
import { actorFor, anAccount, aProfile } from "./support/builders";

function anOpenSlotListingItem(
  overrides: Partial<OpenSlotListingItem> = {},
): OpenSlotListingItem {
  return {
    id: overrides.id ?? "slot-1",
    title: overrides.title ?? "Acoustic guitar afternoon",
    description:
      overrides.description ??
      "A relaxed acoustic session for the pediatric ward.",
    scheduledAt: overrides.scheduledAt ?? new Date(NOW.getTime() + 60_000),
    durationMinutes: overrides.durationMinutes ?? 60,
    location: overrides.location ?? "Ward 3, Room 12",
    hospitalName: overrides.hospitalName ?? "Hospital San Juan",
  };
}

function makeDeps(
  items: readonly OpenSlotListingItem[] = [],
): {
  readonly profiles: InMemoryProfileRepository;
  readonly openSlotListingQuery: OpenSlotListingQuery;
  readonly clock: typeof fixedClock;
} {
  return {
    profiles: new InMemoryProfileRepository(),
    openSlotListingQuery: new FakeOpenSlotListingQuery(items),
    clock: fixedClock,
  };
}

async function seedArtistActor(
  deps: ReturnType<typeof makeDeps>,
  status: "pending" | "active" | "rejected" | "deactivated" = "active",
) {
  const account = anAccount("artist");
  const profile = aProfile("artist", status, { accountId: account.id });
  await deps.profiles.save(profile);
  return actorFor(account, profile);
}

describe("listOpenSlots (active-Artist visibility, N2, dedicated read-model port pr2a-N3)", () => {
  it("returns the joined listing items supplied by the OpenSlotListingQuery port", async () => {
    const item = anOpenSlotListingItem();
    const deps = makeDeps([item]);
    const actor = await seedArtistActor(deps);

    const listing = await listOpenSlots(actor, deps);

    expect(listing).toEqual([item]);
  });

  it("delegates the 'still in the future' filter to the port, passing the injected clock's `now`", async () => {
    const pastItem = anOpenSlotListingItem({
      id: "past-slot",
      scheduledAt: new Date(NOW.getTime() - 1),
    });
    const futureItem = anOpenSlotListingItem({ id: "future-slot" });
    const deps = makeDeps([pastItem, futureItem]);
    const actor = await seedArtistActor(deps);

    const listing = await listOpenSlots(actor, deps);

    expect(listing.map((item) => item.id)).toEqual(["future-slot"]);
  });

  it("denies a pending (inactive) Artist", async () => {
    const deps = makeDeps();
    const actor = await seedArtistActor(deps, "pending");

    await expect(listOpenSlots(actor, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("denies a non-Artist actor (Patient)", async () => {
    const deps = makeDeps();
    const patient = actorFor(anAccount("patient"));

    await expect(listOpenSlots(patient, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("denies an Actor whose Account role is 'artist' but whose live Profile TYPE is 'hospital' (pr2a-N1 defense-in-depth)", async () => {
    const deps = makeDeps();
    const account = anAccount("artist");
    // Corrupted/imported-data scenario: the live Profile is a Hospital
    // Profile despite the Account being role 'artist'.
    const mismatchedProfile = aProfile("hospital", "active", {
      accountId: account.id,
    });
    await deps.profiles.save(mismatchedProfile);
    const actor = actorFor(account, mismatchedProfile);

    await expect(listOpenSlots(actor, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("pr2a-N3: propagates a 'broken relation' failure from the port instead of masking it (fail fast, never a placeholder value)", async () => {
    class FailingOpenSlotListingQuery implements OpenSlotListingQuery {
      async listOpenUpcoming(): Promise<readonly OpenSlotListingItem[]> {
        throw new Error("Slot 'slot-x' has no resolvable owning Hospital Profile");
      }
    }
    const deps = {
      profiles: new InMemoryProfileRepository(),
      openSlotListingQuery: new FailingOpenSlotListingQuery(),
      clock: fixedClock,
    };
    const actor = await seedArtistActor(deps);

    await expect(listOpenSlots(actor, deps)).rejects.toThrow(
      "no resolvable owning Hospital Profile",
    );
  });
});
