import { describe, expect, it } from "vitest";
import { hash } from "@node-rs/argon2";
import { Argon2PasswordHasher } from "@infrastructure/auth/passwordHasher";

/**
 * pr2b-M2: the adapter must pin explicit Argon2id cost parameters (OWASP
 * baseline: memoryCost 19456 KiB, timeCost 2, parallelism 1) rather than
 * inherit the library's weaker defaults (4096 KiB, timeCost 3), and must
 * flag a hash produced with those weaker defaults for an upgrade.
 */
describe("Argon2PasswordHasher (pr2b-M2)", () => {
  const hasher = new Argon2PasswordHasher();

  it("encodes new hashes with the explicit OWASP baseline parameters", async () => {
    const encoded = await hasher.hash("correct-password");
    expect(encoded).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it("verify() accepts a hash produced with the pinned parameters and rejects a wrong password", async () => {
    const encoded = await hasher.hash("correct-password");
    expect(await hasher.verify("correct-password", encoded)).toBe(true);
    expect(await hasher.verify("wrong-password", encoded)).toBe(false);
  });

  it("verify() never throws on a malformed/foreign hash — it simply denies", async () => {
    await expect(
      hasher.verify("anything", "not-a-real-argon2-hash"),
    ).resolves.toBe(false);
  });

  it("needsRehash is false for a hash already at the current baseline", async () => {
    const encoded = await hasher.hash("correct-password");
    expect(hasher.needsRehash(encoded)).toBe(false);
  });

  it("needsRehash is true for a hash produced with weaker cost parameters than the current baseline", async () => {
    // Simulates a legacy hash whose memoryCost/timeCost are below the
    // OWASP baseline this adapter now pins (installed @node-rs/argon2's
    // OWN default already happens to match the baseline exactly, so this
    // test pins deliberately weaker values explicitly to prove
    // `needsRehash` actually compares parameters, not just presence).
    const legacyEncoded = await hash("correct-password", {
      algorithm: 2,
      memoryCost: 4096,
      timeCost: 3,
      parallelism: 1,
    });
    expect(legacyEncoded).toMatch(/^\$argon2id\$v=19\$m=4096,t=3,p=1\$/);
    expect(hasher.needsRehash(legacyEncoded)).toBe(true);
  });

  it("needsRehash is true (fail-safe) for an unrecognised/malformed encoding", () => {
    expect(hasher.needsRehash("not-a-real-argon2-hash")).toBe(true);
  });
});
