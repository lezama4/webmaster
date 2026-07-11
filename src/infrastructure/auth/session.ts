import { createHash, randomBytes } from "node:crypto";
import type { Clock } from "@domain/shared/Clock";
import type { Session, SessionPort } from "@application/ports/SessionPort";
import type { PrismaClientOrTx } from "../persistence/prisma/client";
import { SystemClock } from "../shared/clock";

/** Absolute session lifetime (D7): 12h from issuance. */
export const SESSION_ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;
/** Idle-expiry window (D7): 30min since last authenticated use. */
export const SESSION_IDLE_TTL_MS = 30 * 60 * 1000;

function generateOpaqueToken(): string {
  // 256 bits of CSPRNG entropy (ADR D8) — never reused/extended (rotation, D7).
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  // The DB row stores ONLY this one-way hash — a leaked row (backup, log,
  // replica) is never a usable live session (ADR D8's rejected-alternative
  // rationale).
  return createHash("sha256").update(token).digest("hex");
}

interface SessionRow {
  readonly accountId: string;
  readonly createdAt: Date;
  readonly lastActiveAt: Date;
  readonly absoluteExpiresAt: Date;
}

function toSession(token: string, row: SessionRow): Session {
  return {
    id: token,
    accountId: row.accountId,
    createdAt: row.createdAt,
    lastActiveAt: row.lastActiveAt,
    absoluteExpiresAt: row.absoluteExpiresAt,
  };
}

/**
 * DB-backed `SessionPort` adapter (M3, D7/D8). Accepts either the root
 * Prisma client or a transaction client so `ProfileUnitOfWork` can bind a
 * transaction-scoped instance whose `create`/`revokeAllForAccount` commit
 * atomically with the Profile-status transition that triggered them.
 *
 * The port's `Session.id` is the OPAQUE BEARER TOKEN itself (the value the
 * httpOnly cookie carries) — never the row's own database primary key. The
 * row's `tokenHash` is the only thing ever persisted; the plaintext token
 * exists only in memory and in the client's cookie.
 */
export function createPrismaSessionPort(
  client: PrismaClientOrTx,
  clock: Clock = new SystemClock(),
): SessionPort {
  return {
    async create(accountId: string): Promise<Session> {
      const token = generateOpaqueToken(); // rotation: ALWAYS a fresh id.
      const now = clock.now();
      const row = await client.session.create({
        data: {
          accountId,
          tokenHash: hashToken(token),
          absoluteExpiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS),
          lastActiveAt: now,
        },
      });
      return toSession(token, row);
    },

    async resolveValid(sessionId: string): Promise<Session | null> {
      const row = await client.session.findUnique({
        where: { tokenHash: hashToken(sessionId) },
      });
      if (!row) return null;

      const now = clock.now();
      const absoluteExpired = now.getTime() > row.absoluteExpiresAt.getTime();
      const idleExpired =
        now.getTime() - row.lastActiveAt.getTime() > SESSION_IDLE_TTL_MS;
      if (absoluteExpired || idleExpired) {
        // Opportunistic cleanup — an expired row is never treated as valid
        // again, so there is no reason to keep it.
        await client.session.deleteMany({ where: { id: row.id } });
        return null;
      }

      return toSession(sessionId, row);
    },

    async touch(sessionId: string): Promise<void> {
      const now = clock.now();
      await client.session.updateMany({
        where: {
          tokenHash: hashToken(sessionId),
          absoluteExpiresAt: { gt: now },
        },
        data: { lastActiveAt: now },
      });
    },

    async revokeOne(sessionId: string): Promise<void> {
      await client.session.deleteMany({
        where: { tokenHash: hashToken(sessionId) },
      });
    },

    async revokeAllForAccount(accountId: string): Promise<void> {
      await client.session.deleteMany({ where: { accountId } });
    },
  };
}
