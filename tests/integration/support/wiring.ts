import type { PrismaClient } from "@prisma/client";
import type { Actor } from "@application/Actor";
import type { Profile } from "@domain/profile/Profile";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import {
  PrismaMatchingUnitOfWork,
  type MatchingUnitOfWorkHooks,
} from "@infrastructure/persistence/prisma/MatchingUnitOfWork";
import { PrismaProfileUnitOfWork } from "@infrastructure/persistence/prisma/ProfileUnitOfWork";
import { CryptoIdGenerator } from "@infrastructure/shared/idGenerator";
import { SystemClock } from "@infrastructure/shared/clock";

/**
 * Common Slot-decision use-case deps, wired against real Postgres via the
 * shared Prisma client. `hooks` lets a barrier test force deterministic
 * interleaving on one side of a race.
 *
 * pr2a-M1 (required wiring update): the Slot-mutating use cases now
 * re-check the acting Profile's LIVE status via
 * `ProfileUnitOfWork.withLockedProfile` FROM WITHIN the Slot-lock callback,
 * so `profileUnitOfWork` is now a required dep alongside
 * `matchingUnitOfWork`. `profiles` is kept for fixture seeding/assertions
 * in the existing integration test files, which read it directly.
 */
export function slotDeps(client: PrismaClient, hooks: MatchingUnitOfWorkHooks = {}) {
  return {
    profiles: new PrismaProfileRepository(client),
    matchingUnitOfWork: new PrismaMatchingUnitOfWork(client, hooks),
    profileUnitOfWork: new PrismaProfileUnitOfWork(client),
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
