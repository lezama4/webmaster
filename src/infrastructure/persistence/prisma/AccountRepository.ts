import type { AccountRecord, AccountRepository } from "@application/ports/AccountRepository";
import type { PrismaClientOrTx } from "./client";
import { accountRoleToPrisma, toDomainAccount } from "./mappers";

/** Prisma adapter for `AccountRepository` (Phase 4). Accepts either the root client or a transaction client so it composes inside unit-of-work callbacks. */
export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly client: PrismaClientOrTx) {}

  async findByEmail(email: string): Promise<AccountRecord | null> {
    const row = await this.client.account.findUnique({ where: { email } });
    if (!row) return null;
    return {
      account: toDomainAccount(row),
      passwordHash: row.passwordHash,
    };
  }

  async findById(id: string): Promise<AccountRecord["account"] | null> {
    const row = await this.client.account.findUnique({ where: { id } });
    return row ? toDomainAccount(row) : null;
  }

  async save(record: AccountRecord): Promise<void> {
    const data = {
      email: record.account.email,
      passwordHash: record.passwordHash,
      role: accountRoleToPrisma(record.account.role),
    };
    await this.client.account.upsert({
      where: { id: record.account.id },
      create: { id: record.account.id, ...data },
      update: data,
    });
  }
}
