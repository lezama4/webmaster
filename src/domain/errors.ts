/**
 * Shared domain errors (framework-free).
 *
 * Every rule violation inside `src/domain` raises one of these, never an
 * HTTP/Prisma error — mapping to transport concerns happens in outer layers.
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** An entity was asked to move to a state its state machine does not allow. */
export class InvalidTransitionError extends DomainError {}

/** Input data violates a domain invariant (N2 bounds, entity linkage, etc.). */
export class DomainValidationError extends DomainError {}

/** An actor tried to decide on a Slot its Hospital profile does not own. */
export class NotSlotOwnerError extends DomainError {}
