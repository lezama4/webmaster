"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/request";

/**
 * Flag marks, drawn inline so they render identically on every platform (emoji
 * flags are unavailable for the ikurriña and render inconsistently on Windows).
 * Purely decorative: the ES/EU/EN label beside each one carries the meaning.
 */
function FlagES() {
  return (
    <svg viewBox="0 0 16 12" className="h-3 w-4 rounded-[2px]" aria-hidden="true">
      <rect width="16" height="12" fill="#AA151B" />
      <rect y="3" width="16" height="6" fill="#F1BF00" />
    </svg>
  );
}

/** Ikurriña — the Basque flag. "EU" here is Euskara, never the European Union. */
function FlagEU() {
  return (
    <svg viewBox="0 0 16 12" className="h-3 w-4 rounded-[2px]" aria-hidden="true">
      <rect width="16" height="12" fill="#D52B1E" />
      <g stroke="#009B48" strokeWidth="2.6">
        <path d="M0 0 L16 12" />
        <path d="M16 0 L0 12" />
      </g>
      <rect x="6.4" width="3.2" height="12" fill="#fff" />
      <rect y="4.4" width="16" height="3.2" fill="#fff" />
    </svg>
  );
}

function FlagEN() {
  return (
    <svg viewBox="0 0 16 12" className="h-3 w-4 rounded-[2px]" aria-hidden="true">
      <rect width="16" height="12" fill="#012169" />
      <g stroke="#fff" strokeWidth="3">
        <path d="M0 0 L16 12" />
        <path d="M16 0 L0 12" />
      </g>
      <g stroke="#C8102E" strokeWidth="1.4">
        <path d="M0 0 L16 12" />
        <path d="M16 0 L0 12" />
      </g>
      <rect x="6" width="4" height="12" fill="#fff" />
      <rect y="4" width="16" height="4" fill="#fff" />
      <rect x="6.8" width="2.4" height="12" fill="#C8102E" />
      <rect y="4.8" width="16" height="2.4" fill="#C8102E" />
    </svg>
  );
}

const languages: { code: Locale; label: string; Flag: () => React.ReactElement }[] = [
  { code: "es", label: "ES", Flag: FlagES },
  { code: "eu", label: "EU", Flag: FlagEU },
  { code: "en", label: "EN", Flag: FlagEN },
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
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
            locale === language.code
              ? "bg-surface-2 text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          <language.Flag />
          {language.label}
        </button>
      ))}
    </div>
  );
}
