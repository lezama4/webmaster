import type { Account } from "@domain/account/Account";

/**
 * An Account plus its credential hash. Credentials never enter the domain
 * (ADR D1) — they live only at this port boundary, consumed by `login` /
 * `registerProfile` through the `PasswordHasher` port.
 */
export interface AccountRecord {
  readonly account: Account;
  readonly passwordHash: string;
}

export interface AccountRepository {
  findByEmail(email: string): Promise<AccountRecord | null>;
  findById(id: string): Promise<Account | null>;
  save(record: AccountRecord): Promise<void>;
}
