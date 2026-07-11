import { describe, expect, it } from "vitest";

import { fillSlot } from "@domain/slot/Slot";
import { ForbiddenError } from "@application/errors";
import { listOpenSlots } from "@application/use-cases/listOpenSlots";
import {
  fixedClock,
  InMemoryProfileRepository,
  InMemorySlotRepository,
  NOW,
} from "./support/fakes";
import { actorFor, anAccount, anOpenSlot, aProfile } from "./support/builders";

function makeDeps() {
  return {
    profiles: new InMemoryProfileRepository(),
    slots: new InMemorySlotRepository(),
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

describe("listOpenSlots (active-Artist visibility, N2)", () => {
  it("lists only 'open' Slots with a future scheduledAt, with the hospital's public name", async () => {
    const deps = makeDeps();
    const hospital = aProfile("hospital", "active", {
      name: "Hospital San Juan",
    });
    await deps.profiles.save(hospital);

    const openFuture = anOpenSlot({ hospitalProfileId: hospital.id });
    const filled = fillSlot(anOpenSlot({ hospitalProfileId: hospital.id }));
    // An open Slot created in the past relative to "now" is simulated by an
    // open Slot whose scheduledAt equals NOW (not strictly in the future).
    const openButPast = anOpenSlot({
      hospitalProfileId: hospital.id,
      scheduledAt: new Date(NOW.getTime() + 1),
    });
    await deps.slots.save(openFuture);
    await deps.slots.save(filled);
    await deps.slots.save(openButPast);

    const actor = await seedArtistActor(deps);
    const listing = await listOpenSlots(actor, deps);

    const ids = listing.map((item) => item.id);
    expect(ids).toContain(openFuture.id);
    expect(ids).not.toContain(filled.id);

    const item = listing.find((entry) => entry.id === openFuture.id)!;
    expect(item.hospitalName).toBe("Hospital San Juan");
    expect(item.title).toBe(openFuture.title);
    expect(item.location).toBe(openFuture.location);
  });

  it("excludes an open Slot whose scheduledAt is not in the future anymore", async () => {
    const deps = makeDeps();
    const hospital = aProfile("hospital", "active");
    await deps.profiles.save(hospital);
    // Slot valid at creation (strictly future by 1ms) but no longer future
    // when listed with a clock advanced past it.
    const aboutToPass = anOpenSlot({
      hospitalProfileId: hospital.id,
      scheduledAt: new Date(NOW.getTime() + 1),
    });
    await deps.slots.save(aboutToPass);

    const actor = await seedArtistActor(deps);
    const listing = await listOpenSlots(actor, {
      ...deps,
      clock: { now: () => new Date(NOW.getTime() + 10_000) },
    });

    expect(listing.map((item) => item.id)).not.toContain(aboutToPass.id);
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
});
