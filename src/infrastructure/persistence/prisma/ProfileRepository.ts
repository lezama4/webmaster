import type { Profile } from "@domain/profile/Profile";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { PrismaClientOrTx } from "./client";
import {
  centreTypeToPrisma,
  profileStatusToPrisma,
  profileTypeToPrisma,
  toDomainProfile,
} from "./mappers";

/** Prisma adapter for `ProfileRepository` (Phase 4). */
export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly client: PrismaClientOrTx) {}

  async findById(id: string): Promise<Profile | null> {
    const row = await this.client.profile.findUnique({ where: { id } });
    return row ? toDomainProfile(row) : null;
  }

  async findByAccountId(accountId: string): Promise<Profile | null> {
    const row = await this.client.profile.findUnique({ where: { accountId } });
    return row ? toDomainProfile(row) : null;
  }

  async save(profile: Profile): Promise<void> {
    const data = {
      accountId: profile.accountId,
      type: profileTypeToPrisma(profile.type),
      name: profile.name,
      status: profileStatusToPrisma(profile.status),
      reviewRequestedAt: profile.reviewRequestedAt ?? null,
      city: profile.city ?? null,
      postalCode: profile.postalCode ?? null,
      addressLine: profile.addressLine ?? null,
      latitude: profile.latitude ?? null,
      longitude: profile.longitude ?? null,
      centreType:
        profile.centreType !== undefined
          ? centreTypeToPrisma(profile.centreType)
          : null,
    };
    await this.client.profile.upsert({
      where: { id: profile.id },
      create: { id: profile.id, ...data },
      update: data,
    });
  }
}
