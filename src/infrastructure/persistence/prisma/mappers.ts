import type {
  AccountRole as PrismaAccountRole,
  EventStatus as PrismaEventStatus,
  ProfileStatus as PrismaProfileStatus,
  ProfileType as PrismaProfileType,
  ProposalStatus as PrismaProposalStatus,
  SlotStatus as PrismaSlotStatus,
} from "@prisma/client";
import { rehydrateAccount, type Account, type AccountRole } from "@domain/account/Account";
import {
  rehydrateProfile,
  type Profile,
  type ProfileStatus,
  type ProfileType,
} from "@domain/profile/Profile";
import { rehydrateSlot, type Slot, type SlotStatus } from "@domain/slot/Slot";
import { rehydrateProposal, type Proposal, type ProposalStatus } from "@domain/proposal/Proposal";
import { rehydrateEvent, type Event, type EventStatus } from "@domain/event/Event";

/**
 * Bidirectional enum maps between the domain's lowercase literal unions and
 * Prisma's UPPERCASE generated enum labels (ADR D4/D8 — the raw-SQL partial
 * indexes and every repository adapter must agree on this exact mapping).
 */
const ACCOUNT_ROLE_TO_DOMAIN: Record<PrismaAccountRole, AccountRole> = {
  ADMIN: "admin",
  HOSPITAL: "hospital",
  ARTIST: "artist",
  PATIENT: "patient",
};
const ACCOUNT_ROLE_TO_PRISMA: Record<AccountRole, PrismaAccountRole> = {
  admin: "ADMIN",
  hospital: "HOSPITAL",
  artist: "ARTIST",
  patient: "PATIENT",
};

const PROFILE_TYPE_TO_DOMAIN: Record<PrismaProfileType, ProfileType> = {
  HOSPITAL: "hospital",
  ARTIST: "artist",
};
const PROFILE_TYPE_TO_PRISMA: Record<ProfileType, PrismaProfileType> = {
  hospital: "HOSPITAL",
  artist: "ARTIST",
};

const PROFILE_STATUS_TO_DOMAIN: Record<PrismaProfileStatus, ProfileStatus> = {
  PENDING: "pending",
  ACTIVE: "active",
  REJECTED: "rejected",
  DEACTIVATED: "deactivated",
};
const PROFILE_STATUS_TO_PRISMA: Record<ProfileStatus, PrismaProfileStatus> = {
  pending: "PENDING",
  active: "ACTIVE",
  rejected: "REJECTED",
  deactivated: "DEACTIVATED",
};

const SLOT_STATUS_TO_DOMAIN: Record<PrismaSlotStatus, SlotStatus> = {
  OPEN: "open",
  FILLED: "filled",
  CLOSED: "closed",
};
const SLOT_STATUS_TO_PRISMA: Record<SlotStatus, PrismaSlotStatus> = {
  open: "OPEN",
  filled: "FILLED",
  closed: "CLOSED",
};

const PROPOSAL_STATUS_TO_DOMAIN: Record<PrismaProposalStatus, ProposalStatus> = {
  SUBMITTED: "submitted",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
};
const PROPOSAL_STATUS_TO_PRISMA: Record<ProposalStatus, PrismaProposalStatus> = {
  submitted: "SUBMITTED",
  accepted: "ACCEPTED",
  rejected: "REJECTED",
};

const EVENT_STATUS_TO_DOMAIN: Record<PrismaEventStatus, EventStatus> = {
  CREATED: "created",
  PUBLISHED: "published",
  COMPLETED: "completed",
};
const EVENT_STATUS_TO_PRISMA: Record<EventStatus, PrismaEventStatus> = {
  created: "CREATED",
  published: "PUBLISHED",
  completed: "COMPLETED",
};

export function accountRoleToDomain(role: PrismaAccountRole): AccountRole {
  return ACCOUNT_ROLE_TO_DOMAIN[role];
}
export function accountRoleToPrisma(role: AccountRole): PrismaAccountRole {
  return ACCOUNT_ROLE_TO_PRISMA[role];
}

export function profileTypeToPrisma(type: ProfileType): PrismaProfileType {
  return PROFILE_TYPE_TO_PRISMA[type];
}

export function profileStatusToPrisma(status: ProfileStatus): PrismaProfileStatus {
  return PROFILE_STATUS_TO_PRISMA[status];
}

export function slotStatusToPrisma(status: SlotStatus): PrismaSlotStatus {
  return SLOT_STATUS_TO_PRISMA[status];
}

export function proposalStatusToPrisma(status: ProposalStatus): PrismaProposalStatus {
  return PROPOSAL_STATUS_TO_PRISMA[status];
}

export function eventStatusToPrisma(status: EventStatus): PrismaEventStatus {
  return EVENT_STATUS_TO_PRISMA[status];
}

/** Minimal row shapes accepted by the mappers — decoupled from Prisma's generated payload types so raw-SQL (`$queryRaw`) rows map identically to Client API rows. */
export interface AccountRow {
  readonly id: string;
  readonly email: string;
  readonly role: PrismaAccountRole;
}

export interface ProfileRow {
  readonly id: string;
  readonly accountId: string;
  readonly type: PrismaProfileType;
  readonly name: string;
  readonly status: PrismaProfileStatus;
  readonly reviewRequestedAt: Date | null;
}

export interface SlotRow {
  readonly id: string;
  readonly hospitalProfileId: string;
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  readonly location: string;
  readonly status: PrismaSlotStatus;
}

export interface ProposalRow {
  readonly id: string;
  readonly slotId: string;
  readonly artistProfileId: string;
  readonly message: string;
  readonly status: PrismaProposalStatus;
}

export interface EventRow {
  readonly id: string;
  readonly slotId: string;
  readonly proposalId: string;
  readonly title: string;
  readonly status: PrismaEventStatus;
}

export function toDomainAccount(row: AccountRow): Account {
  return rehydrateAccount({
    id: row.id,
    email: row.email,
    role: accountRoleToDomain(row.role),
  });
}

export function toDomainProfile(row: ProfileRow): Profile {
  return rehydrateProfile({
    id: row.id,
    accountId: row.accountId,
    type: PROFILE_TYPE_TO_DOMAIN[row.type],
    name: row.name,
    status: PROFILE_STATUS_TO_DOMAIN[row.status],
    ...(row.reviewRequestedAt !== null
      ? { reviewRequestedAt: row.reviewRequestedAt }
      : {}),
  });
}

export function toDomainSlot(row: SlotRow): Slot {
  return rehydrateSlot({
    id: row.id,
    hospitalProfileId: row.hospitalProfileId,
    title: row.title,
    description: row.description,
    scheduledAt: row.scheduledAt,
    durationMinutes: row.durationMinutes,
    location: row.location,
    status: SLOT_STATUS_TO_DOMAIN[row.status],
  });
}

export function toDomainProposal(row: ProposalRow): Proposal {
  return rehydrateProposal({
    id: row.id,
    slotId: row.slotId,
    artistProfileId: row.artistProfileId,
    message: row.message,
    status: PROPOSAL_STATUS_TO_DOMAIN[row.status],
  });
}

export function toDomainEvent(row: EventRow): Event {
  return rehydrateEvent({
    id: row.id,
    slotId: row.slotId,
    proposalId: row.proposalId,
    title: row.title,
    status: EVENT_STATUS_TO_DOMAIN[row.status],
  });
}
