import type { Profile } from "@domain/profile/Profile";

export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>;
  /** `Profile.accountId` is unique — at most one Profile per Account. */
  findByAccountId(accountId: string): Promise<Profile | null>;
  save(profile: Profile): Promise<void>;
}
