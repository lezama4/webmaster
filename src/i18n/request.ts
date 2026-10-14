import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const locales = ["es", "eu", "en"] as const;
export const defaultLocale: Locale = "eu";
export type Locale = (typeof locales)[number];

function isLocale(value: string | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  // Basque is the default on first visit; Accept-Language is deliberately ignored.
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
