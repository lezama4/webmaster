import { createAccount } from "@domain/account/Account";
import { profileTypeForRole } from "@domain/account/Account";
import {
  createProfile,
  reactivateProfile,
  type Profile,
} from "@domain/profile/Profile";
import type { Clock } from "@domain/shared/Clock";
import { ConflictError, ForbiddenError, UnauthenticatedError } from "@application/errors";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { PasswordHasher } from "@application/ports/PasswordHasher";
import type { RegistrationUnitOfWork } from "@application/ports/RegistrationUnitOfWork";
import type { AccountRole } from "@domain/account/Account";

export interface RegisterProfileInput {
  readonly email: string;
  readonly password: string;
  readonly role: AccountRole;
  readonly name: string;
}

export interface RegisterProfileDeps {
  readonly registrationUnitOfWork: RegistrationUnitOfWork;
  readonly passwordHasher: PasswordHasher;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/** Generic denial (mirrors login's M4 stance): no distinguishing detail beyond "credentials rejected". */
const INVALID_EXISTING_CREDENTIALS = "Invalid credentials for the existing account";

/**
 * Self-registration (Hospital/Artist only, D2) — creates a `pending` Profile
 * for a NEW Account, or (pr2a-B2/M2) re-registers into an EXISTING Account
 * after verifying its password. Committed exclusively through
 * `RegistrationUnitOfWork.withLockedRegistration` (pr2a-M5) — Account
 * creation, Profile creation/reactivation, and the email-uniqueness check
 * all happen inside ONE locked transaction, closing the orphan-Account and
 * concurrent-duplicate-registration gaps a two-step, unguarded write left
 * open.
 *
 * pr2a-B2: for ANY existing email (whether it already has a Profile or
 * not), the caller MUST prove they control the Account by supplying its
 * CURRENT password — re-registration is a credential-verified operation,
 * never an unauthenticated email-only reactivation. The requested role MUST
 * also match the stored Account role; a mismatch is denied, never silently
 * honored.
 */
export async function registerProfile(
  input: RegisterProfileInput,
  deps: RegisterProfileDeps,
): Promise<Profile> {
  const type = profileTypeForRole(input.role);
  if (!type) {
    throw new ForbiddenError(`Role '${input.role}' cannot self-register a Profile`);
  }

  return deps.registrationUnitOfWork.withLockedRegistration(
    input.email,
    async (ctx) => {
      if (ctx.existing) {
        // pr2a-B2 (BLOCKER): re-registering into an existing Account
        // requires proving control of it via its CURRENT password — never
        // an unverified, email-only reactivation.
        const validCredentials = await deps.passwordHasher.verify(
          input.password,
          ctx.existing.passwordHash,
        );
        if (!validCredentials) {
          throw new UnauthenticatedError(INVALID_EXISTING_CREDENTIALS);
        }
        // pr2a-B2: the requested role MUST match the stored Account role —
        // a caller cannot re-register a Hospital email as an Artist (or
        // vice versa) even with the correct password.
        if (ctx.existing.account.role !== input.role) {
          throw new ForbiddenError(
            `Account '${input.email}' is registered as '${ctx.existing.account.role}', not '${input.role}'`,
          );
        }

        const existingProfile = ctx.existing.profile;
        if (existingProfile) {
          if (existingProfile.status === "rejected") {
            // Re-registration (M2): reactivate the SAME Profile row, never
            // a second one — rejected -> pending, timestamped as a new
            // review request (D8).
            const reactivated = reactivateProfile(existingProfile, deps.clock);
            await ctx.saveProfile(reactivated);
            return reactivated;
          }
          throw new ConflictError(
            `Account '${input.email}' already has a Profile in '${existingProfile.status}' state`,
          );
        }

        // No existing Profile (unexpected but harmless, D2) — create one
        // now that the password/role have been verified.
        const profile = createProfile({
          id: deps.idGenerator.next(),
          accountId: ctx.existing.account.id,
          type,
          name: input.name,
        });
        await ctx.saveProfile(profile);
        return profile;
      }

      const passwordHash = await deps.passwordHasher.hash(input.password);
      const account = createAccount({
        id: deps.idGenerator.next(),
        email: input.email,
        role: input.role,
      });
      const profile = createProfile({
        id: deps.idGenerator.next(),
        accountId: account.id,
        type,
        name: input.name,
      });
      await ctx.createAccountAndProfile(account, passwordHash, profile);
      return profile;
    },
  );
}
