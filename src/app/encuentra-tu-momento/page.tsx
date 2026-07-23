import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { listPublicHospitals } from "@application/use-cases/listPublicHospitals";
import { CENTRE_TYPES, type CentreType } from "@domain/profile/Profile";
import { hospitalDirectoryDeps } from "@infrastructure/composition/container";
import { ShareRow } from "@ui/share/ShareRow";
import { absoluteUrl, buildPageMetadata, SITE_NAME } from "@/app/metadata";

import { HospitalFinder } from "./HospitalFinder";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [t, tHome] = await Promise.all([getTranslations("Finder"), getTranslations("Home")]);
  return buildPageMetadata({
    pageTitle: t("title"),
    // Reuses the on-page description verbatim (D10): it never mentions
    // events, scheduled activities, or anything event-derived — a
    // separate OG/share string would just be a new surface to re-audit
    // for the same non-correlation invariant. See
    // tests/unit/application/nonCorrelation.test.ts and
    // e2e/non-correlation.spec.ts for the enforcement.
    description: t("description"),
    path: "/encuentra-tu-momento",
    imageAlt: tHome("hero.imageAlt"),
  });
}

/**
 * Normalises `searchParams.q` (Next 16: a Promise resolving to
 * `string | string[] | undefined`) into a single string — takes the first
 * element of a repeated param, mirrors `filterHospitals`' own handling of
 * the same edge case (ADR D12).
 */
function normaliseQ(q: string | readonly string[] | undefined): string {
  if (Array.isArray(q)) return q[0] ?? "";
  return typeof q === "string" ? q : "";
}

/**
 * Normalises `searchParams.type` (ADR D19/D12 extension) into a validated
 * `CentreType | "all"` — mirrors `normaliseQ`'s array/undefined handling,
 * but additionally rejects any value that is not one of the six known
 * `CentreType`s (an arbitrary/manipulated `?type=` value falls back to
 * `"all"` rather than reaching `filterHospitals` unchecked).
 */
function normaliseType(type: string | readonly string[] | undefined): CentreType | "all" {
  const raw = Array.isArray(type) ? (type[0] ?? "all") : typeof type === "string" ? type : "all";
  return (CENTRE_TYPES as readonly string[]).includes(raw) ? (raw as CentreType) : "all";
}

export default async function HospitalFinderPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; type?: string | string[] }>;
}) {
  const [hospitals, t, tShare, resolvedSearchParams] = await Promise.all([
    listPublicHospitals(hospitalDirectoryDeps()),
    getTranslations("Finder"),
    getTranslations("Share"),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3 pb-10">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-[52ch] text-muted">{t("description")}</p>
      </header>
      <HospitalFinder
        hospitals={hospitals}
        initialQuery={normaliseQ(resolvedSearchParams.q)}
        initialType={normaliseType(resolvedSearchParams.type)}
      />

      {/* Discreet, page-level share row (product decision — page-level
          only, not per-hospital: PublicHospitalProjection carries no
          public id to deep-link to, see ADR D10). Reuses Finder.description
          as the share message — same D10 rationale as generateMetadata
          above: it never mentions events or scheduled activities. */}
      <div className="mt-16 flex flex-col gap-3 border-t border-border pt-8">
        <p className="text-sm font-medium text-foreground">{tShare("heading")}</p>
        <ShareRow
          url={absoluteUrl("/encuentra-tu-momento")}
          title={`${SITE_NAME} — ${t("title")}`}
          text={t("description")}
        />
      </div>
    </div>
  );
}
