/** Fixture builders — construct valid domain objects through the domain factories. */
import {
  type Account,
  type AccountRole,
  createAccount,
} from "@domain/account/Account";
import {
  approveProfile,
  createProfile,
  deactivateProfile,
  type Profile,
  type ProfileType,
  rejectProfile,
} from "@domain/profile/Profile";
import {
  createProposal,
  type Proposal,
} from "@domain/proposal/Proposal";
import { createSlot, type Audience, type Slot } from "@domain/slot/Slot";
import type { Actor } from "@application/Actor";
import { fixedClock } from "./fakes";

let sequence = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++sequence}`;
}

export function anAccount(
  role: AccountRole,
  overrides: Partial<{ id: string; email: string }> = {},
): Account {
  const id = overrides.id ?? nextId(`${role}-account`);
  return createAccount({
    id,
    email: overrides.email ?? `${id}@vtt.test`,
    role,
  });
}

export function aProfile(
  type: ProfileType,
  status: "pending" | "active" | "rejected" | "deactivated",
  overrides: Partial<{ id: string; accountId: string; name: string }> = {},
): Profile {
  const pending = createProfile({
    id: overrides.id ?? nextId(`${type}-profile`),
    accountId: overrides.accountId ?? nextId(`${type}-account`),
    type,
    name: overrides.name ?? `${type} name`,
  });
  switch (status) {
    case "pending":
      return pending;
    case "active":
      return approveProfile(pending);
    case "rejected":
      return rejectProfile(pending);
    case "deactivated":
      return deactivateProfile(approveProfile(pending));
  }
}

export function actorFor(account: Account, profile?: Profile): Actor {
  return {
    accountId: account.id,
    role: account.role,
    profileId: profile?.id,
    profileStatus: profile?.status,
  };
}

export function anOpenSlot(
  overrides: Partial<{
    id: string;
    hospitalProfileId: string;
    title: string;
    description: string;
    scheduledAt: Date;
    durationMinutes: number;
    location: string;
    audience: Audience;
  }> = {},
): Slot {
  return createSlot(
    {
      id: overrides.id ?? nextId("slot"),
      hospitalProfileId: overrides.hospitalProfileId ?? "hospital-profile-x",
      title: overrides.title ?? "Acoustic guitar afternoon",
      description:
        overrides.description ??
        "A relaxed acoustic session for the pediatric ward.",
      scheduledAt: overrides.scheduledAt ?? new Date("2026-08-01T17:00:00Z"),
      durationMinutes: overrides.durationMinutes ?? 60,
      location: overrides.location ?? "Ward 3, Room 12",
      audience: overrides.audience ?? "all_ages",
    },
    fixedClock,
  );
}

export function aProposal(
  slotId: string,
  artistProfileId: string,
  overrides: Partial<{ id: string; message: string }> = {},
): Proposal {
  return createProposal({
    id: overrides.id ?? nextId("proposal"),
    slotId,
    artistProfileId,
    message: overrides.message ?? "I would love to play for the kids.",
  });
}
