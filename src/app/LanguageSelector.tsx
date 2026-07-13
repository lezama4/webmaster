"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/request";

const languages: { code: Locale; label: string }[] = [
  { code: "es", label: "ES" },
  { code: "eu", label: "EU" },
  { code: "en", label: "EN" },
];

export function LanguageSelector() {
  const router = useRouter();
  const t = useTranslations("LanguageSelector");
  const locale = useLocale() as Locale;

  function changeLocale(nextLocale: Locale) {
    // eslint-disable-next-line react-hooks/immutability -- cookie updates are an intentional user event side effect.
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1" aria-label={t("label")}>
      {languages.map((language) => (
        <button
          key={language.code}
          type="button"
          onClick={() => changeLocale(language.code)}
          aria-pressed={locale === language.code}
          className={`rounded-full px-2 py-1 text-xs font-medium transition-colors ${
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
