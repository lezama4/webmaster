import type { Clock } from "@domain/shared/Clock";

/** A controllable `Clock` for integration tests that need to simulate absolute/idle expiry without literally waiting 12h/30min. */
export class FakeClock implements Clock {
  private current: Date;

  constructor(start: Date = new Date()) {
    this.current = start;
  }

  now(): Date {
    return this.current;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
