import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  ExistingRegistration,
  LockedRegistrationContext,
  RegistrationUnitOfWork,
  RegistrationWork,
} from "@application/ports/RegistrationUnitOfWork";
import { ConflictError } from "@application/errors";
import type { Account } from "@domain/account/Account";
import type { Profile } from "@domain/profile/Profile";
import {
  accountRoleToPrisma,
  profileStatusToPrisma,
  profileTypeToPrisma,
  toDomainAccount,
  toDomainProfile,
} from "./mappers";

const UNIQUE_VIOLATION = "P2002";

interface LockedAccountRow {
  readonly id: string;
}

/** Test-only barrier instrumentation; it is not part of the application port. */
export interface RegistrationUnitOfWorkHooks {
  /** Invoked after the email/advisory lock and live Account/Profile read. */
  readonly afterLock?: (email: string) => Promise<void> | void;
}

function normalizedEmailForAdvisoryLock(email: string): string {
  return email.trim().toLowerCase();
}

function accountData(account: Account, passwordHash: string) {
  return {
    email: account.email,
    passwordHash,
    role: accountRoleToPrisma(account.role),
  };
}

function profileData(profile: Profile) {
  return {
    accountId: profile.accountId,
    type: profileTypeToPrisma(profile.type),
    name: profile.name,
    status: profileStatusToPrisma(profile.status),
    reviewRequestedAt: profile.reviewRequestedAt ?? null,
  };
}

/**
 * Lock-first Account/Profile registration coordinator (pr2a-M5). Existing
 * Account rows are locked with `FOR UPDATE`. A first registration has no row
 * to lock, so it serializes contenders through a transaction-scoped Postgres
 * advisory lock on the normalized email, then re-reads under `FOR UPDATE`.
 *
 * The live read plus every Account/Profile write happen in one transaction.
 * This prevents duplicate first registrations and guarantees a Profile write
 * failure rolls the preceding Account insert back with the transaction.
 */
export class PrismaRegistrationUnitOfWork implements RegistrationUnitOfWork {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hooks: RegistrationUnitOfWorkHooks = {},
  ) {}

  async withLockedRegistration<T>(
    email: string,
    work: RegistrationWork<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Lock an existing Account before reading it. For a new email, lock
          // the normalized advisory key and then re-read: another contender
          // may have created the row while this transaction waited.
          let lockedRows = await tx.$queryRaw<LockedAccountRow[]>(
            Prisma.sql`SELECT "id" FROM "accounts" WHERE "email" = ${email} FOR UPDATE`,
          );

          if (!lockedRows[0]) {
            await tx.$executeRaw(
              Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${normalizedEmailForAdvisoryLock(email)}))`,
            );
            lockedRows = await tx.$queryRaw<LockedAccountRow[]>(
              Prisma.sql`SELECT "id" FROM "accounts" WHERE "email" = ${email} FOR UPDATE`,
            );
          }

          const accountRow = await tx.account.findUnique({ where: { email } });
          const profileRow = accountRow
            ? await tx.profile.findUnique({ where: { accountId: accountRow.id } })
            : null;
          const existing: ExistingRegistration | null = accountRow
            ? {
                account: toDomainAccount(accountRow),
                passwordHash: accountRow.passwordHash,
                profile: profileRow ? toDomainProfile(profileRow) : null,
              }
            : null;

          await this.hooks.afterLock?.(email);

          const ctx: LockedRegistrationContext = {
            existing,
            createAccountAndProfile: async (account, passwordHash, profile) => {
              await tx.account.create({
                data: { id: account.id, ...accountData(account, passwordHash) },
              });
              await tx.profile.create({
                data: { id: profile.id, ...profileData(profile) },
              });
            },
            saveProfile: async (profile) => {
              const data = profileData(profile);
              await tx.profile.upsert({
                where: { id: profile.id },
                create: { id: profile.id, ...data },
                update: data,
              });
            },
          };

          return work(ctx);
        },
        { timeout: 15_000, maxWait: 15_000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictError(
          `Registration for '${email}' violates an Account or Profile uniqueness invariant`,
        );
      }
      throw error;
    }
  }
}
