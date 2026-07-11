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

/** Common Slot-decision use-case deps, wired against real Postgres via the shared Prisma client. `hooks` lets a barrier test force deterministic interleaving on one side of a race. */
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
