import { getTranslations } from "next-intl/server";

import { listPublicHospitals } from "@application/use-cases/listPublicHospitals";
import { hospitalDirectoryDeps } from "@infrastructure/composition/container";

import { HospitalFinder } from "./HospitalFinder";

export const dynamic = "force-dynamic";

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

export default async function HospitalFinderPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [hospitals, t, resolvedSearchParams] = await Promise.all([
    listPublicHospitals(hospitalDirectoryDeps()),
    getTranslations("Finder"),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3 pb-10">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-[52ch] text-muted">{t("description")}</p>
      </header>
      <HospitalFinder hospitals={hospitals} initialQuery={normaliseQ(resolvedSearchParams.q)} />
    </div>
  );
}
