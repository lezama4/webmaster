import {
  DomainValidationError,
  InvalidTransitionError,
  NotSlotOwnerError,
} from "../errors";
import type { Clock } from "../shared/Clock";

export type SlotStatus = "open" | "filled" | "closed";

/** Text bounds per design N2 ("sane, explicit length bounds"). */
export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const LOCATION_MIN_LENGTH = 1;
export const LOCATION_MAX_LENGTH = 200;

/**
 * A Hospital's published time slot (ADR D3 shape).
 * State machine: open -> filled | closed.
 */
export interface Slot {
  readonly id: string;
  readonly hospitalProfileId: string;
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  readonly location: string;
  readonly status: SlotStatus;
}

export interface CreateSlotInput {
  readonly id: string;
  readonly hospitalProfileId: string;
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  readonly location: string;
}

function assertTextBounds(
  field: string,
  value: string,
  min: number,
  max: number,
): void {
  const length = value.trim().length;
  if (length < min || length > max) {
    throw new DomainValidationError(
      `Slot ${field} must be between ${min} and ${max} characters (got ${length})`,
    );
  }
}

/**
 * Creates an 'open' Slot, enforcing the N2 invariants: strictly-future
 * scheduledAt (via the injected Clock — never Date.now()), positive integer
 * duration, and bounded title/description/location text.
 */
export function createSlot(input: CreateSlotInput, clock: Clock): Slot {
  if (input.scheduledAt.getTime() <= clock.now().getTime()) {
    throw new DomainValidationError(
      "Slot scheduledAt must be strictly in the future",
    );
  }
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes <= 0
  ) {
    throw new DomainValidationError(
      "Slot durationMinutes must be a positive integer",
    );
  }
  assertTextBounds("title", input.title, TITLE_MIN_LENGTH, TITLE_MAX_LENGTH);
  assertTextBounds("description", input.description, 0, DESCRIPTION_MAX_LENGTH);
  assertTextBounds(
    "location",
    input.location,
    LOCATION_MIN_LENGTH,
    LOCATION_MAX_LENGTH,
  );

  return {
    id: input.id,
    hospitalProfileId: input.hospitalProfileId,
    title: input.title.trim(),
    description: input.description.trim(),
    scheduledAt: input.scheduledAt,
    durationMinutes: input.durationMinutes,
    location: input.location.trim(),
    status: "open",
  };
}

function assertOpen(slot: Slot, transition: string): void {
  if (slot.status !== "open") {
    throw new InvalidTransitionError(
      `Cannot ${transition} a slot in '${slot.status}' state (requires 'open')`,
    );
  }
}

/** A Proposal was accepted for this slot: open -> filled. */
export function fillSlot(slot: Slot): Slot {
  assertOpen(slot, "fill");
  return { ...slot, status: "filled" };
}

/** The owning Hospital withdraws the slot: open -> closed. */
export function closeSlot(slot: Slot): Slot {
  assertOpen(slot, "close");
  return { ...slot, status: "closed" };
}

/**
 * Pure ownership guard: only the owning Hospital profile decides on a Slot
 * (approve/reject/close). The application layer calls this with the live
 * actor's profile id — HTTP mapping (403) happens in outer layers.
 */
export function assertSlotOwnedBy(
  slot: Slot,
  hospitalProfileId: string,
): void {
  if (slot.hospitalProfileId !== hospitalProfileId) {
    throw new NotSlotOwnerError(
      `Slot '${slot.id}' is not owned by hospital profile '${hospitalProfileId}'`,
    );
  }
}
