import { baseURL } from "./baseUrl";

// Basque is the app's default locale, but the suite asserts English copy. Tests
// choose their locale here, once, through the same NEXT_LOCALE cookie a real
// visitor's choice persists in. Used by playwright.config.ts and by helpers that
// open their own browser context (those do not inherit `use`).
export const testLocaleStorageState = {
  cookies: [
    {
      name: "NEXT_LOCALE",
      value: "en",
      domain: new URL(baseURL).hostname,
      path: "/",
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    },
  ],
  origins: [],
};
