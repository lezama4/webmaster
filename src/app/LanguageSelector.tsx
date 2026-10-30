"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/request";

/**
 * Each language is named in itself (an endonym), so these labels are not
 * translated and live outside `messages/`. Order: Euskara · Castellano · English.
 */
const languages: { code: Locale; label: string }[] = [
  { code: "eu", label: "Euskara" },
  { code: "es", label: "Castellano" },
  { code: "en", label: "English" },
];

export function LanguageSelector({ touch = false }: { touch?: boolean }) {
  const router = useRouter();
  const t = useTranslations("LanguageSelector");
  const locale = useLocale() as Locale;

  function changeLocale(nextLocale: Locale) {
    // eslint-disable-next-line react-hooks/immutability -- cookie updates are an intentional user event side effect.
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div role="group" className="flex flex-wrap items-center gap-1" aria-label={t("label")}>
      {languages.map((language) => (
        <button
          key={language.code}
          type="button"
          lang={language.code}
          onClick={() => changeLocale(language.code)}
          aria-current={locale === language.code ? "true" : undefined}
          className={`inline-flex items-center rounded-full font-medium ${touch ? "min-h-11 px-4 text-sm" : "min-h-6 px-2 py-1 text-xs"} transition-colors ${
            locale === language.code
              ? "bg-surface-2 text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          {language.label}
        </button>
      ))}
    </div>
  );
}
