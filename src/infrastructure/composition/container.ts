import { PrismaClient } from "@prisma/client";
import type { AccountRepository } from "@application/ports/AccountRepository";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { SessionPort } from "@application/ports/SessionPort";
import type { MatchingUnitOfWork } from "@application/ports/MatchingUnitOfWork";
import type { ProfileUnitOfWork } from "@application/ports/ProfileUnitOfWork";
import type { Clock } from "@domain/shared/Clock";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { RegisterProfileDeps } from "@application/use-cases/registerProfile";
import type { LoginDeps } from "@application/use-cases/login";
import type { LogoutDeps } from "@application/use-cases/logout";
import type { PublishSlotDeps } from "@application/use-cases/publishSlot";
import type { ListPublishedEventsDeps } from "@application/use-cases/listPublishedEvents";
import type { ListPendingProfilesDeps } from "@application/use-cases/listPendingProfiles";
import type { ListHospitalSlotsDeps } from "@application/use-cases/listHospitalSlots";
import { PrismaAccountRepository } from "@infrastructure/persistence/prisma/AccountRepository";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import { PrismaRegistrationUnitOfWork } from "@infrastructure/persistence/prisma/RegistrationUnitOfWork";
import { PrismaProfileUnitOfWork } from "@infrastructure/persistence/prisma/ProfileUnitOfWork";
import { PrismaMatchingUnitOfWork } from "@infrastructure/persistence/prisma/MatchingUnitOfWork";
import { PrismaPublicEventProjectionQuery } from "@infrastructure/persistence/prisma/PublicEventProjectionQuery";
import { PrismaPendingProfileQuery } from "@infrastructure/persistence/prisma/PendingProfileQuery";
import { PrismaHospitalSlotBoardQuery } from "@infrastructure/persistence/prisma/HospitalSlotBoardQuery";
import { PrismaLoginRateLimiter } from "@infrastructure/auth/loginRateLimiter";
import { Argon2PasswordHasher } from "@infrastructure/auth/passwordHasher";
import { createPrismaSessionPort } from "@infrastructure/auth/session";
import { CryptoIdGenerator } from "@infrastructure/shared/idGenerator";
import { SystemClock } from "@infrastructure/shared/clock";

/**
 * Composition root (Phase 5 foundation, task 5.1/5.2). Wires the same
 * Prisma adapters `tests/integration/support/wiring.ts` already uses for
 * Slot-decision use cases, but for the delivery boundary (route handlers)
 * against ONE shared Prisma client — never a fresh client per request.
 *
 * `globalThis` caching (Next.js dev pattern): Next's dev server hot-reloads
 * route modules on every save, which would otherwise create a fresh
 * `PrismaClient` (and a fresh connection pool) per reload. Caching on
 * `globalThis` in non-production survives that reload; in production the
 * module is loaded once per server process, so the module-level singleton
 * below is never re-created without the cache either.
 */
const globalForPrisma = globalThis as unknown as {
  __vttPrismaClient?: PrismaClient;
};

function createClient(): PrismaClient {
  return new PrismaClient();
}

export const prismaClient: PrismaClient =
  globalForPrisma.__vttPrismaClient ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__vttPrismaClient = prismaClient;
}

/** `registerProfile` deps (task 5.1). */
export function registrationDeps(): RegisterProfileDeps {
  return {
    registrationUnitOfWork: new PrismaRegistrationUnitOfWork(prismaClient),
    passwordHasher: new Argon2PasswordHasher(),
    idGenerator: new CryptoIdGenerator(),
    clock: new SystemClock(),
  };
}

/** `login` deps (task 5.2). */
export function loginDeps(): LoginDeps {
  return {
    accounts: new PrismaAccountRepository(prismaClient),
    passwordHasher: new Argon2PasswordHasher(),
    rateLimiter: new PrismaLoginRateLimiter(prismaClient),
    profileUnitOfWork: new PrismaProfileUnitOfWork(prismaClient),
  };
}

/** `logout` deps (task 5.2). */
export function logoutDeps(): LogoutDeps {
  return {
    sessions: sessionPort(),
  };
}

/** Shared `SessionPort` instance bound to the singleton client — used by `getCurrentActor`/`logout` at the delivery boundary. */
export function sessionPort(): SessionPort {
  return createPrismaSessionPort(prismaClient);
}

/** Shared `AccountRepository` instance — used by `getCurrentActor` to resolve the session's owning Account. */
export function accountRepository(): AccountRepository {
  return new PrismaAccountRepository(prismaClient);
}

/** Shared `ProfileRepository` instance — used by `getCurrentActor` to resolve the session owner's Profile (id/status), when one exists (D2). */
export function profileRepository(): ProfileRepository {
  return new PrismaProfileRepository(prismaClient);
}

/** `listPublishedEvents` deps (task 5.7) — public/anonymous, no auth-related dep. */
export function publicDeps(): ListPublishedEventsDeps {
  return {
    publicEventProjectionQuery: new PrismaPublicEventProjectionQuery(prismaClient),
  };
}

/** `publishSlot` deps (task 5.4). */
export function publishSlotDeps(): PublishSlotDeps {
  return {
    profileUnitOfWork: new PrismaProfileUnitOfWork(prismaClient),
    idGenerator: new CryptoIdGenerator(),
    clock: new SystemClock(),
  };
}

/**
 * Shared Slot-decision deps (tasks 5.4-5.6/5.10): `submitProposal`,
 * `approveProposal`, `rejectProposal`, and `closeSlot` each declare a Deps
 * interface that is a subset of this shape (mirrors
 * `tests/integration/support/wiring.ts`'s `slotDeps`) — passing this single
 * object to any of them satisfies their narrower Deps type structurally.
 */
export interface MatchingDeps {
  readonly matchingUnitOfWork: MatchingUnitOfWork;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

export function matchingDeps(): MatchingDeps {
  return {
    matchingUnitOfWork: new PrismaMatchingUnitOfWork(prismaClient),
    idGenerator: new CryptoIdGenerator(),
    clock: new SystemClock(),
  };
}

/**
 * Shared Admin deps (tasks 5.3/5.11): `validateProfile` and
 * `deactivateProfile` declare the identical Deps shape.
 */
export interface AdminDeps {
  readonly profiles: ProfileRepository;
  readonly profileUnitOfWork: ProfileUnitOfWork;
}

export function adminDeps(): AdminDeps {
  return {
    profiles: new PrismaProfileRepository(prismaClient),
    profileUnitOfWork: new PrismaProfileUnitOfWork(prismaClient),
  };
}

/** `listPendingProfiles` deps — Admin pending-profile queue (5.3/5.12). */
export function pendingProfilesDeps(): ListPendingProfilesDeps {
  return {
    pendingProfileQuery: new PrismaPendingProfileQuery(prismaClient),
  };
}

/** `listHospitalSlots` deps — Hospital's own slot board (5.4/5.6/5.10). */
export function hospitalSlotBoardDeps(): ListHospitalSlotsDeps {
  return {
    profiles: new PrismaProfileRepository(prismaClient),
    hospitalSlotBoardQuery: new PrismaHospitalSlotBoardQuery(prismaClient),
  };
}
