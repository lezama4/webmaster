import type { PrismaClient } from "@prisma/client";
import type { Actor } from "@application/Actor";
import type { Profile } from "@domain/profile/Profile";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import {
  PrismaMatchingUnitOfWork,
  type MatchingUnitOfWorkHooks,
} from "@infrastructure/persistence/prisma/MatchingUnitOfWork";
import { CryptoIdGenerator } from "@infrastructure/shared/idGenerator";
import { SystemClock } from "@infrastructure/shared/clock";

/**
 * Common Slot-decision use-case deps, wired against real Postgres via the
 * shared Prisma client. `hooks` lets a barrier test force deterministic
 * interleaving on one side of a race.
 *
 * recheck-pr2a-verify-M2 (wiring update): the Slot-mutating use cases no
 * longer take a separate `ProfileUnitOfWork` dep — `MatchingUnitOfWork.
 * withLockedSlot` itself locks the actor's Account and reads the live
 * Profile inside the SAME transaction that locks the Slot and persists the
 * mutation. `profiles` is kept for fixture seeding/assertions in the
 * existing integration test files, which read it directly.
 */
export function slotDeps(client: PrismaClient, hooks: MatchingUnitOfWorkHooks = {}) {
  return {
    profiles: new PrismaProfileRepository(client),
    matchingUnitOfWork: new PrismaMatchingUnitOfWork(client, hooks),
    idGenerator: new CryptoIdGenerator(),
    clock: new SystemClock(),
  };
}

export function actorFor(profile: Profile, accountId: string, role: Actor["role"]): Actor {
  return {
    accountId,
    role,
    profileId: profile.id,
    profileStatus: profile.status,
  };
}
