import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@application/errors";
import { listHospitalSlots } from "@application/use-cases/listHospitalSlots";
import type { HospitalSlotView } from "@application/dto/HospitalSlotView";
import { FakeHospitalSlotBoardQuery, InMemoryProfileRepository } from "./support/fakes";
import { actorFor, anAccount, aProfile } from "./support/builders";

function aHospitalSlotView(
  overrides: Partial<HospitalSlotView> = {},
): HospitalSlotView {
  return {
    slotId: overrides.slotId ?? "slot-1",
    title: overrides.title ?? "Acoustic guitar afternoon",
    scheduledAt: overrides.scheduledAt ?? new Date("2026-08-01T17:00:00Z"),
    status: overrides.status ?? "open",
    proposals: overrides.proposals ?? [
      {
        proposalId: "proposal-1",
        artistDisplayName: "Clara",
        message: "I would love to play for the kids.",
        status: "submitted",
      },
    ],
    audience: overrides.audience ?? "all_ages",
  };
}

async function seedHospitalActor(
  profiles: InMemoryProfileRepository,
  status: "pending" | "active" | "rejected" | "deactivated" = "active",
) {
  const account = anAccount("hospital");
  const profile = aProfile("hospital", status, { accountId: account.id });
  await profiles.save(profile);
  return { actor: actorFor(account, profile), profile };
}

describe("listHospitalSlots (Hospital's own slot board, 5.4/5.6/5.10)", () => {
  it("returns the joined board items supplied by the HospitalSlotBoardQuery port, scoped to the acting Hospital's own profile id", async () => {
    const profiles = new InMemoryProfileRepository();
    const { actor, profile } = await seedHospitalActor(profiles);
    const item = aHospitalSlotView();
    const query = new FakeHospitalSlotBoardQuery([item]);
    const deps = { profiles, hospitalSlotBoardQuery: query };

    const result = await listHospitalSlots(actor, deps);

    expect(result).toEqual([item]);
    expect(query.calls).toEqual([profile.id]);
  });

  it("returns an empty list when the Hospital owns no Slot", async () => {
    const profiles = new InMemoryProfileRepository();
    const { actor } = await seedHospitalActor(profiles);
    const deps = {
      profiles,
      hospitalSlotBoardQuery: new FakeHospitalSlotBoardQuery([]),
    };

    const result = await listHospitalSlots(actor, deps);

    expect(result).toEqual([]);
  });

  it("denies a pending (inactive) Hospital", async () => {
    const profiles = new InMemoryProfileRepository();
    const { actor } = await seedHospitalActor(profiles, "pending");
    const deps = {
      profiles,
      hospitalSlotBoardQuery: new FakeHospitalSlotBoardQuery([]),
    };

    await expect(listHospitalSlots(actor, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("denies a non-Hospital actor (Artist)", async () => {
    const profiles = new InMemoryProfileRepository();
    const artist = actorFor(anAccount("artist"));
    const deps = {
      profiles,
      hospitalSlotBoardQuery: new FakeHospitalSlotBoardQuery([]),
    };

    await expect(listHospitalSlots(artist, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("denies an Actor whose Account role is 'hospital' but whose live Profile TYPE is 'artist' (defense-in-depth, mirrors pr2a-N1)", async () => {
    const profiles = new InMemoryProfileRepository();
    const account = anAccount("hospital");
    const mismatchedProfile = aProfile("artist", "active", {
      accountId: account.id,
    });
    await profiles.save(mismatchedProfile);
    const actor = actorFor(account, mismatchedProfile);
    const deps = {
      profiles,
      hospitalSlotBoardQuery: new FakeHospitalSlotBoardQuery([]),
    };

    await expect(listHospitalSlots(actor, deps)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("every returned Slot AND its Proposals are STRUCTURALLY limited to the allow-list — hostile adapter fields are structurally absent", async () => {
    const profiles = new InMemoryProfileRepository();
    const { actor } = await seedHospitalActor(profiles);
    const hostileItem = {
      ...aHospitalSlotView(),
      hospitalProfileId: "hospital-profile-secret",
      proposals: [
        {
          proposalId: "proposal-1",
          artistDisplayName: "Clara",
          message: "I would love to play for the kids.",
          status: "submitted",
          artistProfileId: "artist-profile-secret",
          email: "clara@vtt.test",
        },
      ],
    } as unknown as HospitalSlotView;
    const deps = {
      profiles,
      hospitalSlotBoardQuery: new FakeHospitalSlotBoardQuery([hostileItem]),
    };

    const result = await listHospitalSlots(actor, deps);

    expect(result).toHaveLength(1);
    const [slot] = result;
    expect(Object.keys(slot).sort()).toEqual(
      ["audience", "proposals", "scheduledAt", "slotId", "status", "title"].sort(),
    );
    expect(slot).not.toHaveProperty("hospitalProfileId");
    expect(slot.proposals).toHaveLength(1);
    const [proposal] = slot.proposals;
    expect(Object.keys(proposal).sort()).toEqual(
      ["artistDisplayName", "message", "proposalId", "status"].sort(),
    );
    expect(proposal).not.toHaveProperty("artistProfileId");
    expect(proposal).not.toHaveProperty("email");
  });
});
