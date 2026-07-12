import { PrismaClient } from "@prisma/client";
import type { AccountRepository } from "@application/ports/AccountRepository";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { SessionPort } from "@application/ports/SessionPort";
import type { RegisterProfileDeps } from "@application/use-cases/registerProfile";
import type { LoginDeps } from "@application/use-cases/login";
import type { LogoutDeps } from "@application/use-cases/logout";
import { PrismaAccountRepository } from "@infrastructure/persistence/prisma/AccountRepository";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import { PrismaRegistrationUnitOfWork } from "@infrastructure/persistence/prisma/RegistrationUnitOfWork";
import { PrismaProfileUnitOfWork } from "@infrastructure/persistence/prisma/ProfileUnitOfWork";
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
