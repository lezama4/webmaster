/** Credential hashing port (argon2id adapter in infrastructure, ADR D1). */
export interface PasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, passwordHash: string): Promise<boolean>;
}
