/** Credential hashing port (argon2id adapter in infrastructure, ADR D1). */
export interface PasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, passwordHash: string): Promise<boolean>;
  /**
   * True when an already-verified hash's encoded parameters are weaker
   * than the adapter's current baseline (pr2b-M2) — e.g. produced by an
   * older cost-parameter version, or the library's un-pinned defaults.
   * Callers (`login`) re-hash and persist the upgrade on the next
   * successful login; never called on a hash that has not just verified.
   */
  needsRehash(passwordHash: string): boolean;
}
