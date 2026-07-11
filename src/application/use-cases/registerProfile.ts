import { createAccount } from "@domain/account/Account";
import { profileTypeForRole } from "@domain/account/Account";
import {
  createProfile,
  reactivateProfile,
  type Profile,
} from "@domain/profile/Profile";
import type { Clock } from "@domain/shared/Clock";
import { ConflictError, ForbiddenError } from "@application/errors";
import type { AccountRepository } from "@application/ports/AccountRepository";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type { PasswordHasher } from "@application/ports/PasswordHasher";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { AccountRole } from "@domain/account/Account";

export interface RegisterProfileInput {
  readonly email: string;
  readonly password: string;
  readonly role: AccountRole;
  readonly name: string;
}

export interface RegisterProfileDeps {
  readonly accounts: AccountRepository;
  readonly profiles: ProfileRepository;
  readonly passwordHasher: PasswordHasher;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/**
 * Self-registration (Hospital/Artist only, D2) — creates a `pending` Profile
 * for a NEW Account. Denies Admin/Patient self-registration (they never hold
 * a Profile). Denies a duplicate registration while an existing Profile for
 * the Account is not `rejected` (ConflictError) — one live Profile per
 * Account at a time.
 */
export async function registerProfile(
  input: RegisterProfileInput,
  deps: RegisterProfileDeps,
): Promise<Profile> {
  const type = profileTypeForRole(input.role);
  if (!type) {
    throw new ForbiddenError(`Role '${input.role}' cannot self-register a Profile`);
  }

  const existing = await deps.accounts.findByEmail(input.email);
  if (existing) {
    const existingProfile = await deps.profiles.findByAccountId(
      existing.account.id,
    );
    if (existingProfile) {
      if (existingProfile.status === "rejected") {
        // Re-registration (M2): reactivate the SAME Profile row, never a
        // second one — rejected -> pending, timestamped as a new review
        // request (D8).
        const reactivated = reactivateProfile(existingProfile, deps.clock);
        await deps.profiles.save(reactivated);
        return reactivated;
      }
      throw new ConflictError(
        `Account '${input.email}' already has a Profile in '${existingProfile.status}' state`,
      );
    }
    // No existing Profile (unexpected but harmless) — create one now.
    const profile = createProfile({
      id: deps.idGenerator.next(),
      accountId: existing.account.id,
      type,
      name: input.name,
    });
    await deps.profiles.save(profile);
    return profile;
  }

  const passwordHash = await deps.passwordHasher.hash(input.password);
  const account = createAccount({
    id: deps.idGenerator.next(),
    email: input.email,
    role: input.role,
  });
  await deps.accounts.save({ account, passwordHash });

  const profile = createProfile({
    id: deps.idGenerator.next(),
    accountId: account.id,
    type,
    name: input.name,
  });
  await deps.profiles.save(profile);
  return profile;
}
