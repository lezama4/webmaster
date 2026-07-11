/**
 * The public, unauthenticated Event projection — an explicit ALLOW-LIST
 * (ADR D6). These five fields are the ONLY data the public endpoint may
 * expose. Forbidden, always: Slot `location` (ward/room), the accepted
 * Proposal's `message`, any email, and any internal database identifier.
 */
export interface PublicEventProjection {
  readonly title: string;
  readonly description: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number;
  /** The accepted Proposal's Artist public display name (Profile.name). */
  readonly artistName: string;
}
