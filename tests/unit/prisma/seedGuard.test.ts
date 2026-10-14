import { describe, expect, it } from "vitest";
import { assertSeedAllowed } from "../../../prisma/seedGuard";

const allowed = (env: Record<string, string | undefined>) => () => assertSeedAllowed(env);

describe("assertSeedAllowed", () => {
  it.each([
    "postgresql://u:p@localhost:5432/db?schema=public",
    "postgresql://u:p@127.0.0.1:5432/db",
    "postgres://localhost/db",
  ])("allows a local database: %s", (DATABASE_URL) => {
    expect(allowed({ DATABASE_URL })).not.toThrow();
  });

  it("allows a remote database when DEMO_MODE is exactly true", () => {
    expect(allowed({ DEMO_MODE: "true", DATABASE_URL: "postgresql://u:p@db.neon.tech/db" })).not.toThrow();
    expect(allowed({ DEMO_MODE: "true" })).not.toThrow();
  });

  it.each([
    ["remote host", "postgresql://u:p@db.neon.tech:5432/db"],
    ["suffix lookalike", "postgresql://u:p@localhost.evil.com:5432/db"],
    ["prefix lookalike", "postgresql://u:p@evil-localhost:5432/db"],
    ["localhost in userinfo", "postgresql://localhost:5432@evil.com:5432/db"],
    ["localhost in path", "postgresql://user@evil.com:5432/localhost"],
    ["localhost in query", "postgresql://u:p@evil.com/db?x=localhost"],
    ["host query override", "postgresql://u:p@localhost/db?host=evil.com"],
    ["127.0.0.1 lookalike", "postgresql://u:p@127.0.0.1.evil.com/db"],
    ["multi-host list", "postgresql://localhost,evil.com/db"],
    ["unparsable", "not a url"],
    ["empty", ""],
  ])("blocks %s", (_label, DATABASE_URL) => {
    expect(allowed({ DATABASE_URL })).toThrow(/Refusing to seed/);
  });

  it("blocks when DATABASE_URL is missing", () => {
    expect(allowed({})).toThrow(/Refusing to seed/);
  });

  it.each(["TRUE", "1", "yes", "false", ""])("does not treat DEMO_MODE=%j as demo", (DEMO_MODE) => {
    expect(allowed({ DEMO_MODE, DATABASE_URL: "postgresql://u:p@evil.com/db" })).toThrow(/Refusing to seed/);
  });
});
