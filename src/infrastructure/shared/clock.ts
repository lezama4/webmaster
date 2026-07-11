import type { Clock } from "@domain/shared/Clock";

/** Real wall-clock adapter for the `Clock` port. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
