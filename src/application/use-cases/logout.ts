import type { SessionPort } from "@application/ports/SessionPort";

export interface LogoutDeps {
  readonly sessions: SessionPort;
}

/** Logout revokes EXACTLY the presented session (D7) — not every session. */
export async function logout(sessionId: string, deps: LogoutDeps): Promise<void> {
  await deps.sessions.revokeOne(sessionId);
}
