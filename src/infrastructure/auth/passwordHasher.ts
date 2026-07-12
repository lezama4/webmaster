import { hash, verify } from "@node-rs/argon2";
import type { Algorithm, Version } from "@node-rs/argon2";
import type { PasswordHasher } from "@application/ports/PasswordHasher";

/**
 * argon2id `PasswordHasher` adapter (ADR D1). `@node-rs/argon2` ships
 * prebuilt native bindings (no build toolchain required, incl. Windows
 * `win32-x64-msvc`).
 *
 * pr2b-M2 fix: EVERY cost parameter is pinned explicitly to the OWASP
 * Password Storage Cheat Sheet's Argon2id baseline — never left to the
 * library's own defaults. The installed `@node-rs/argon2` version's native
 * default happens to already match this baseline (verified empirically:
 * `hash(x)` with no options yields `m=19456,t=2,p=1`), but the package's
 * OWN type declarations document a weaker default (memoryCost 4096 KiB,
 * timeCost 3) for the general API contract — an un-pinned call is one
 * dependency upgrade away from silently reverting to (or otherwise
 * changing to) a weaker value with zero diff in this file. Pinning
 * removes that risk entirely regardless of which default is accurate at
 * any given version:
 *   - `memoryCost`: 19456 KiB (19 MiB)
 *   - `timeCost`: 2 iterations
 *   - `parallelism`: 1 thread
 *   - `version`: 0x13 (19 decimal) — the current Argon2 spec revision
 *   - `outputLen`: 32 bytes (the library's own default, pinned explicitly
 *     so a future default change cannot silently alter it either)
 *
 * `2`/`1` are `Algorithm.Argon2id`/`Version.V0x13` — the library's ambient
 * `const enum` values cannot be imported directly under `isolatedModules`;
 * the numeric literals are pinned instead and cast to each enum's type.
 */
const ARGON2ID_MEMORY_COST = 19_456;
const ARGON2ID_TIME_COST = 2;
const ARGON2ID_PARALLELISM = 1;
const ARGON2ID_VERSION_DECIMAL = 19;
const ARGON2ID_OUTPUT_LEN = 32;

const ARGON2ID_OPTIONS = {
  algorithm: 2 as Algorithm, // Argon2id
  memoryCost: ARGON2ID_MEMORY_COST,
  timeCost: ARGON2ID_TIME_COST,
  parallelism: ARGON2ID_PARALLELISM,
  version: 1 as Version, // Version.V0x13 (0x13 = 19 decimal)
  outputLen: ARGON2ID_OUTPUT_LEN,
} as const;

/** Matches the encoded `$argon2id$v=<version>$m=<memoryCost>,t=<timeCost>,p=<parallelism>$...` prefix every `@node-rs/argon2` hash carries. */
const ENCODED_PARAMS_PATTERN = /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$/;

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

  /**
   * pr2b-M2 (upgrade-on-login): compares an ALREADY-VERIFIED hash's own
   * encoded parameters against the current baseline. Any encoding this
   * adapter cannot parse is treated as needing an upgrade (fail-safe
   * toward re-hashing, never toward silently keeping a weaker hash).
   */
  needsRehash(passwordHash: string): boolean {
    const match = ENCODED_PARAMS_PATTERN.exec(passwordHash);
    if (!match) return true;
    const [, versionStr, memoryStr, timeStr, parallelismStr] = match;
    const version = Number(versionStr);
    const memoryCost = Number(memoryStr);
    const timeCost = Number(timeStr);
    const parallelism = Number(parallelismStr);
    return (
      version < ARGON2ID_VERSION_DECIMAL ||
      memoryCost < ARGON2ID_MEMORY_COST ||
      timeCost < ARGON2ID_TIME_COST ||
      parallelism < ARGON2ID_PARALLELISM
    );
  }
}
