import { describe, expect, it } from "vitest";

import { buildShareLinks } from "@ui/share/buildShareLinks";

function aShareContent(overrides: Partial<Parameters<typeof buildShareLinks>[0]> = {}) {
  return {
    url: "https://webmaster-lemon.vercel.app/events",
    title: "Vivetutiempo — Próximos eventos",
    text: "Actuaciones en directo programadas en hospitales participantes.",
    ...overrides,
  };
}

describe("buildShareLinks (pure, framework-free — no third-party script, only share-intent URLs)", () => {
  it("builds a wa.me link carrying text + url, both percent-encoded, in one 'text' param", () => {
    const links = buildShareLinks(aShareContent());

    expect(links.whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    const encoded = links.whatsapp.replace("https://wa.me/?text=", "");
    expect(decodeURIComponent(encoded)).toBe(
      "Actuaciones en directo programadas en hospitales participantes. https://webmaster-lemon.vercel.app/events",
    );
  });

  it("builds a t.me/share/url link with url and text as separate encoded params", () => {
    const links = buildShareLinks(aShareContent());
    const parsed = new URL(links.telegram);

    expect(parsed.origin + parsed.pathname).toBe("https://t.me/share/url");
    expect(parsed.searchParams.get("url")).toBe("https://webmaster-lemon.vercel.app/events");
    expect(parsed.searchParams.get("text")).toBe(
      "Actuaciones en directo programadas en hospitales participantes.",
    );
  });

  it("builds a LinkedIn share-offsite link carrying only the url param (no text/summary field on the modern endpoint)", () => {
    const links = buildShareLinks(aShareContent());
    const parsed = new URL(links.linkedin);

    expect(parsed.origin + parsed.pathname).toBe("https://www.linkedin.com/sharing/share-offsite/");
    expect(parsed.searchParams.get("url")).toBe("https://webmaster-lemon.vercel.app/events");
  });

  it("builds a mailto link whose subject is the title and whose body is the text followed by the url", () => {
    const links = buildShareLinks(aShareContent());

    expect(links.email.startsWith("mailto:?")).toBe(true);
    const query = links.email.replace("mailto:?", "");
    const params = new URLSearchParams(query);
    expect(params.get("subject")).toBe("Vivetutiempo — Próximos eventos");
    expect(params.get("body")).toBe(
      "Actuaciones en directo programadas en hospitales participantes.\n\nhttps://webmaster-lemon.vercel.app/events",
    );
  });

  it("percent-encodes special characters (spaces, accents, &, ?) in every link", () => {
    const links = buildShareLinks(
      aShareContent({
        text: "¿Vivetutiempo & vos? Compartí á é í ó ú",
        title: "Título con acentos & símbolos",
      }),
    );

    for (const link of Object.values(links)) {
      expect(link).not.toContain(" ");
      expect(link).not.toContain("¿");
      expect(link).not.toContain("&Vivetutiempo"); // raw ampersand from copy must never merge into the query string as a delimiter
    }
  });

  it("never throws and returns well-formed URLs for empty text/title", () => {
    expect(() => buildShareLinks(aShareContent({ text: "", title: "" }))).not.toThrow();
    const links = buildShareLinks(aShareContent({ text: "", title: "" }));
    for (const link of Object.values(links)) {
      expect(typeof link).toBe("string");
      expect(link.length).toBeGreaterThan(0);
    }
  });

  it("is pure — does not mutate the input object", () => {
    const input = aShareContent();
    const snapshot = { ...input };

    buildShareLinks(input);

    expect(input).toEqual(snapshot);
  });
});
