import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const locales = ["es", "eu", "en"] as const;
export const defaultLocale: Locale = "eu";
export type Locale = (typeof locales)[number];

function isLocale(value: string | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}

/** A valid NEXT_LOCALE cookie wins; anything else is Basque. Accept-Language is deliberately ignored. */
export function resolveLocale(cookieValue: string | undefined): Locale {
  return isLocale(cookieValue) ? cookieValue : defaultLocale;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = resolveLocale(cookieLocale);

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
