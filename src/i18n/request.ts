import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const locales = ["es", "eu", "en"] as const;
export type Locale = (typeof locales)[number];

function isLocale(value: string | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}

function getAcceptedLocale(acceptLanguage: string | null): Locale | undefined {
  if (!acceptLanguage) return undefined;

  for (const language of acceptLanguage.split(",")) {
    const locale = language.trim().split(";")[0]?.split("-")[0]?.toLowerCase();
    if (isLocale(locale)) return locale;
  }

  return undefined;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : getAcceptedLocale(headerStore.get("accept-language")) ?? "es";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
