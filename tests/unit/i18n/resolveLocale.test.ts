import { describe, expect, it } from "vitest";
import { resolveLocale } from "@/i18n/request";

describe("resolveLocale", () => {
  it.each(["es", "eu", "en"])("keeps a valid cookie (%s)", (value) => {
    expect(resolveLocale(value)).toBe(value);
  });

  it.each([undefined, "", "fr", "ES", "eu-ES"])("falls back to Basque for %j", (value) => {
    expect(resolveLocale(value)).toBe("eu");
  });
});
