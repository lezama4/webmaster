import {
  DomainValidationError,
  InvalidTransitionError,
  NotSlotOwnerError,
} from "../errors";
import type { Clock } from "../shared/Clock";

export type SlotStatus = "open" | "filled" | "closed";

/**
 * The hospital-set age band a Slot's activity targets (Phase 1). Single-
 * select, fixed union — filtering by this value comes in a later phase.
 */
export type Audience =
  | "all_ages"
  | "early_childhood"
  | "children"
  | "teens"
  | "adults";

/** Text bounds per design N2 ("sane, explicit length bounds"). */
export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const LOCATION_MIN_LENGTH = 1;
export const LOCATION_MAX_LENGTH = 200;

const SLOT_STATUSES: readonly SlotStatus[] = ["open", "filled", "closed"];
const AUDIENCES: readonly Audience[] = [
  "all_ages",
  "early_childhood",
  "children",
  "teens",
  "adults",
];

/**
 * Nominal brand (M1): a unique symbol, never exported, so outer code cannot
 * satisfy the `Slot` type with a structural literal — the ONLY ways to
 * obtain a `Slot` are `createSlot` (forces `open`) and `rehydrateSlot`
 * (validates persisted data). Type-only, erased at compile time, so `Slot`
 * values stay plain, serializable objects.
 */
declare const SLOT_BRAND: unique symbol;

/**
 * A Hospital's published time slot (ADR D3 shape).
 * State machine: open -> filled | closed.
 *
 * `scheduledAt` (M3) is exposed as a read accessor backed by an internal
 * epoch-ms primitive, never the caller's `Date` reference: every read
 * returns a freshly-constructed `Date`, so neither the `Date` a caller
 * passed into `createSlot`/`rehydrateSlot` nor the `Date` a caller reads
 * back out can ever mutate the Slot's actual scheduled time.
 */
export type Slot = {
  readonly id: string;
  readonly hospitalProfileId: string;
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  readonly location: string;
  readonly status: SlotStatus;
  readonly audience: Audience;
} & { readonly [SLOT_BRAND]: "Slot" };

export interface CreateSlotInput {
  readonly id: string;
  readonly hospitalProfileId: string;
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  readonly location: string;
  readonly audience: Audience;
}

export interface RehydrateSlotInput {
  readonly id: string;
  readonly hospitalProfileId: string;
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  readonly location: string;
  readonly status: SlotStatus;
  readonly audience: Audience;
}

interface SlotFields {
  readonly id: string;
  readonly hospitalProfileId: string;
  readonly title: string;
  readonly description: string;
  readonly durationMinutes: number;
  readonly location: string;
  readonly status: SlotStatus;
  readonly audience: Audience;
}

/**
 * Builds a Slot from its non-date fields plus a captured epoch-ms timestamp
 * (M3). `scheduledAt` is a getter closing over the primitive `scheduledAtMs`
 * — never over the original `Date` object — so every access allocates a new
 * `Date` and no external reference can ever alias the Slot's internal time.
 */
function buildSlot(fields: SlotFields, scheduledAtMs: number): Slot {
  return {
    id: fields.id,
    hospitalProfileId: fields.hospitalProfileId,
    title: fields.title,
    description: fields.description,
    durationMinutes: fields.durationMinutes,
    location: fields.location,
    status: fields.status,
    audience: fields.audience,
    get scheduledAt(): Date {
      return new Date(scheduledAtMs);
    },
  } as Slot;
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

function assertPositiveIntegerDuration(durationMinutes: number): void {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new DomainValidationError(
      "Slot durationMinutes must be a positive integer",
    );
  }
}

function assertFiniteScheduledAt(scheduledAtMs: number): void {
  if (!Number.isFinite(scheduledAtMs)) {
    throw new DomainValidationError(
      "Slot scheduledAt must be a valid, finite date",
    );
  }
}

function assertValidAudience(audience: Audience): void {
  if (!AUDIENCES.includes(audience)) {
    throw new DomainValidationError(`Slot audience '${audience}' is invalid`);
  }
}

/**
 * Creates an 'open' Slot, enforcing the N2 invariants: a finite, strictly-
 * future `scheduledAt` (via the injected Clock — never `Date.now()`, and
 * never `new Date(NaN)`, M3), positive integer duration, and bounded
 * title/description/location text.
 */
export function createSlot(input: CreateSlotInput, clock: Clock): Slot {
  const scheduledAtMs = input.scheduledAt.getTime();
  assertFiniteScheduledAt(scheduledAtMs);
  if (scheduledAtMs <= clock.now().getTime()) {
    throw new DomainValidationError(
      "Slot scheduledAt must be strictly in the future",
    );
  }
  assertPositiveIntegerDuration(input.durationMinutes);
  assertTextBounds("title", input.title, TITLE_MIN_LENGTH, TITLE_MAX_LENGTH);
  assertTextBounds("description", input.description, 0, DESCRIPTION_MAX_LENGTH);
  assertTextBounds(
    "location",
    input.location,
    LOCATION_MIN_LENGTH,
    LOCATION_MAX_LENGTH,
  );
  assertValidAudience(input.audience);

  return buildSlot(
    {
      id: input.id,
      hospitalProfileId: input.hospitalProfileId,
      title: input.title.trim(),
      description: input.description.trim(),
      durationMinutes: input.durationMinutes,
      location: input.location.trim(),
      status: "open",
      audience: input.audience,
    },
    scheduledAtMs,
  );
}

/**
 * Rebuilds a Slot from persisted data (M1). Unlike `createSlot`, this MAY
 * produce a Slot in any valid status with a `scheduledAt` in the past
 * (a `filled`/`closed` Slot legitimately has one) — the strictly-future
 * check only applies at creation time. Every field is still validated
 * (finite date, valid status, positive duration, text bounds) so corrupt
 * persisted data fails fast rather than silently rehydrating.
 */
export function rehydrateSlot(input: RehydrateSlotInput): Slot {
  const scheduledAtMs = input.scheduledAt.getTime();
  assertFiniteScheduledAt(scheduledAtMs);
  if (!SLOT_STATUSES.includes(input.status)) {
    throw new DomainValidationError(`Slot status '${input.status}' is invalid`);
  }
  assertPositiveIntegerDuration(input.durationMinutes);
  assertTextBounds("title", input.title, TITLE_MIN_LENGTH, TITLE_MAX_LENGTH);
  assertTextBounds("description", input.description, 0, DESCRIPTION_MAX_LENGTH);
  assertTextBounds(
    "location",
    input.location,
    LOCATION_MIN_LENGTH,
    LOCATION_MAX_LENGTH,
  );
  assertValidAudience(input.audience);

  return buildSlot(
    {
      id: input.id,
      hospitalProfileId: input.hospitalProfileId,
      title: input.title,
      description: input.description,
      durationMinutes: input.durationMinutes,
      location: input.location,
      status: input.status,
      audience: input.audience,
    },
    scheduledAtMs,
  );
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
  return buildSlot(
    {
      id: slot.id,
      hospitalProfileId: slot.hospitalProfileId,
      title: slot.title,
      description: slot.description,
      durationMinutes: slot.durationMinutes,
      location: slot.location,
      status: "filled",
      audience: slot.audience,
    },
    slot.scheduledAt.getTime(),
  );
}

/** The owning Hospital withdraws the slot: open -> closed. */
export function closeSlot(slot: Slot): Slot {
  assertOpen(slot, "close");
  return buildSlot(
    {
      id: slot.id,
      hospitalProfileId: slot.hospitalProfileId,
      title: slot.title,
      description: slot.description,
      durationMinutes: slot.durationMinutes,
      location: slot.location,
      status: "closed",
      audience: slot.audience,
    },
    slot.scheduledAt.getTime(),
  );
}

/**
 * Pure ownership guard (M2 — decision: ownership is a domain rule): only the
 * owning Hospital profile decides on a Slot (approve/reject/close).
 * `acceptProposal` and `closeSlot` (the cascade operations) call this
 * internally with the acting Hospital's profile id; HTTP mapping (403)
 * happens in outer layers.
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
