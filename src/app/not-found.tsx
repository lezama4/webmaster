import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { primaryButton, secondaryButton } from "@ui/components/ui";

import { buildPageMetadata } from "@/app/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [t, tHome] = await Promise.all([getTranslations("NotFound"), getTranslations("Home")]);
  return buildPageMetadata({
    pageTitle: t("title"),
    description: t("description"),
    path: "/",
    imageAlt: tHome("hero.imageAlt"),
  });
}

/** Localized 404 (es/eu/en via the request locale), replacing Next's English default. */
export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-24 sm:px-6">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-accent-text">{t("eyebrow")}</span>
        <h1 className="font-heading text-balance text-4xl font-normal tracking-tight md:text-5xl">{t("title")}</h1>
        <p className="max-w-[52ch] text-lg text-muted">{t("description")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={primaryButton}>
          {t("home")}
        </Link>
        <Link href="/events" className={secondaryButton}>
          {t("events")}
        </Link>
      </div>
    </div>
  );
}
