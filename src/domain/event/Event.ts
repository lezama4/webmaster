import { InvalidTransitionError } from "../errors";

export type EventStatus = "created" | "published" | "completed";

/**
 * A confirmed activity born from an accepted Proposal on a filled Slot.
 * Lifecycle: created -> published -> completed.
 */
export interface Event {
  readonly id: string;
  readonly slotId: string;
  readonly proposalId: string;
  readonly title: string;
  readonly status: EventStatus;
}

export interface CreateEventInput {
  readonly id: string;
  readonly slotId: string;
  readonly proposalId: string;
  readonly title: string;
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

/** Creates a new Event in 'created' state from its accepted Proposal origin. */
export function createEvent(input: CreateEventInput): Event {
  return { ...input, status: "created" };
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
