import type { PrismaClient } from "@prisma/client";
import { createAccount } from "@domain/account/Account";
import { createProfile, approveProfile } from "@domain/profile/Profile";
import { createSlot } from "@domain/slot/Slot";
import { createProposal } from "@domain/proposal/Proposal";
import { PrismaAccountRepository } from "@infrastructure/persistence/prisma/AccountRepository";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import { PrismaSlotRepository } from "@infrastructure/persistence/prisma/SlotRepository";
import { PrismaProposalRepository } from "@infrastructure/persistence/prisma/ProposalRepository";
import { SystemClock } from "@infrastructure/shared/clock";

const clock = new SystemClock();
let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function createHospitalProfile(
  client: PrismaClient,
  overrides: { readonly name?: string } = {},
) {
  const accounts = new PrismaAccountRepository(client);
  const profiles = new PrismaProfileRepository(client);

  const account = createAccount({
    id: nextId("account-hospital"),
    email: `${nextId("hospital")}@vtt.test`,
    role: "hospital",
  });
  await accounts.save({ account, passwordHash: "unused-in-fixtures" });

  const profile = approveProfile(
    createProfile({
      id: nextId("profile-hospital"),
      accountId: account.id,
      type: "hospital",
      name: overrides.name ?? "San Juan Hospital",
    }),
  );
  await profiles.save(profile);
  return { account, profile };
}

export async function createArtistProfile(
  client: PrismaClient,
  overrides: { readonly name?: string } = {},
) {
  const accounts = new PrismaAccountRepository(client);
  const profiles = new PrismaProfileRepository(client);

  const account = createAccount({
    id: nextId("account-artist"),
    email: `${nextId("artist")}@vtt.test`,
    role: "artist",
  });
  await accounts.save({ account, passwordHash: "unused-in-fixtures" });

  const profile = approveProfile(
    createProfile({
      id: nextId("profile-artist"),
      accountId: account.id,
      type: "artist",
      name: overrides.name ?? "Clara the Artist",
    }),
  );
  await profiles.save(profile);
  return { account, profile };
}

export async function createOpenSlot(
  client: PrismaClient,
  hospitalProfileId: string,
  overrides: { readonly title?: string } = {},
) {
  const slots = new PrismaSlotRepository(client);
  const slot = createSlot(
    {
      id: nextId("slot"),
      hospitalProfileId,
      title: overrides.title ?? "Afternoon storytelling",
      description: "A calm activity for the pediatric ward.",
      scheduledAt: new Date(clock.now().getTime() + 7 * 24 * 60 * 60 * 1000),
      durationMinutes: 60,
      location: "Ward 3B",
    },
    clock,
  );
  await slots.save(slot);
  return slot;
}

export async function createSubmittedProposal(
  client: PrismaClient,
  slotId: string,
  artistProfileId: string,
  overrides: { readonly message?: string } = {},
) {
  const proposals = new PrismaProposalRepository(client);
  const proposal = createProposal({
    id: nextId("proposal"),
    slotId,
    artistProfileId,
    message: overrides.message ?? "We would love to perform.",
  });
  await proposals.save(proposal);
  return proposal;
}
