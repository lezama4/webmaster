import { DomainValidationError, InvalidTransitionError } from "../errors";

export type EventStatus = "created" | "published" | "completed";

const EVENT_STATUSES: readonly EventStatus[] = [
  "created",
  "published",
  "completed",
];

/**
 * Nominal brand (M1): a unique symbol, never exported, so outer code cannot
 * satisfy the `Event` type with a structural literal — the ONLY ways to
 * obtain an `Event` are `createEvent` (forces `created`) and
 * `rehydrateEvent` (validates persisted data). Type-only, erased at compile
 * time, so `Event` values stay plain, serializable objects.
 */
declare const EVENT_BRAND: unique symbol;

/**
 * A confirmed activity born from an accepted Proposal on a filled Slot.
 * Lifecycle: created -> published -> completed.
 */
export type Event = {
  readonly id: string;
  readonly slotId: string;
  readonly proposalId: string;
  readonly title: string;
  readonly status: EventStatus;
} & { readonly [EVENT_BRAND]: "Event" };

export interface CreateEventInput {
  readonly id: string;
  readonly slotId: string;
  readonly proposalId: string;
  readonly title: string;
}

export interface RehydrateEventInput extends CreateEventInput {
  readonly status: EventStatus;
}

function assertNonEmpty(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new DomainValidationError(`Event ${field} must not be empty`);
  }
}

function assertValidStatus(status: EventStatus): void {
  if (!EVENT_STATUSES.includes(status)) {
    throw new DomainValidationError(`Event status '${status}' is invalid`);
  }
}

function assertFields(input: CreateEventInput): void {
  assertNonEmpty("id", input.id);
  assertNonEmpty("slotId", input.slotId);
  assertNonEmpty("proposalId", input.proposalId);
  assertNonEmpty("title", input.title);
}

/**
 * Creates a new Event. ALWAYS starts in 'created' (M1: the initial state is
 * forced by this factory, not left to the caller to fabricate).
 */
export function createEvent(input: CreateEventInput): Event {
  assertFields(input);

  return {
    id: input.id,
    slotId: input.slotId,
    proposalId: input.proposalId,
    title: input.title,
    status: "created",
  } as Event;
}

/**
 * Rebuilds an Event from persisted data (M1). Unlike `createEvent`, this
 * MAY produce an Event in any valid status (including `published` or
 * `completed`) because it represents state that already went through a
 * legitimate transition before being persisted — every field is validated,
 * so corrupt/invalid persisted data fails fast here.
 */
export function rehydrateEvent(input: RehydrateEventInput): Event {
  assertFields(input);
  assertValidStatus(input.status);

  return {
    id: input.id,
    slotId: input.slotId,
    proposalId: input.proposalId,
    title: input.title,
    status: input.status,
  } as Event;
}

function assertStatus(
  event: Event,
  expected: EventStatus,
  transition: string,
): void {
  if (event.status !== expected) {
    throw new InvalidTransitionError(
      `Cannot ${transition} an event in '${event.status}' state (requires '${expected}')`,
    );
  }
}

/** Makes the event publicly visible: created -> published. */
export function publishEvent(event: Event): Event {
  assertStatus(event, "created", "publish");
  return { ...event, status: "published" };
}

/** Marks the event as held (Block 2 seam): published -> completed. */
export function completeEvent(event: Event): Event {
  assertStatus(event, "published", "complete");
  return { ...event, status: "completed" };
}
