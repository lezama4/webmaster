import { hash, verify } from "@node-rs/argon2";
import type { Algorithm } from "@node-rs/argon2";
import type { PasswordHasher } from "@application/ports/PasswordHasher";

/**
 * argon2id `PasswordHasher` adapter (ADR D1). `@node-rs/argon2` ships
 * prebuilt native bindings (no build toolchain required, incl. Windows
 * `win32-x64-msvc`). The algorithm is pinned explicitly — never left to the
 * library's default — so a future dependency upgrade cannot silently
 * downgrade the hash to Argon2i/Argon2d.
 *
 * `2` is `Algorithm.Argon2id` (the library's ambient `const enum` value
 * cannot be imported directly under `isolatedModules`; the numeric literal
 * is pinned instead and cast to the enum's type).
 */
const ARGON2ID_OPTIONS = { algorithm: 2 as Algorithm } as const;

export class Argon2PasswordHasher implements PasswordHasher {
  async hash(plaintext: string): Promise<string> {
    return hash(plaintext, ARGON2ID_OPTIONS);
  }

  async verify(plaintext: string, passwordHash: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plaintext, ARGON2ID_OPTIONS);
    } catch {
      // A malformed/foreign hash (e.g. corrupt row) must never throw
      // through the credential-check path — it is simply not a match.
      return false;
    }
  }
}
