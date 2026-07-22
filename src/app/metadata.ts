import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import type { Locale } from "@/i18n/request";

/** Stable production URL — deliberately NOT `VERCEL_URL` (see `resolveMetadataBase`'s comment) and never read from an env var, since it must be a safe default even when nothing is configured. */
const PRODUCTION_URL = "https://webmaster-lemon.vercel.app";

/**
 * Resolves the base URL Next.js uses to turn every relative Open Graph /
 * Twitter `url` and `images` entry into an absolute one.
 *
 * Vercel injects `VERCEL_URL` (host only, no protocol) on EVERY deployment,
 * including previews — each preview build gets its own, unique host. If
 * this hardcoded the production domain, a reviewer opening a preview's
 * `/events` page would get Open Graph tags pointing at PRODUCTION: a link
 * shared from that preview would unfurl (and deep-link back) to the wrong
 * deployment. `VERCEL_ENV` distinguishes "production" from
 * "preview"/"development" — on Vercel, `VERCEL_URL` is always the
 * ephemeral per-build host, never the stable production alias, so
 * production intentionally skips it in favour of the fixed default below;
 * every non-production Vercel build uses its own `VERCEL_URL` so it
 * self-references correctly. Local dev (no Vercel env vars at all) falls
 * back to the same production default, since there is nothing else to
 * prefer.
 */
function resolveMetadataBase(): URL {
  if (process.env.VERCEL_ENV !== "production" && process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL(PRODUCTION_URL);
}

export const metadataBase = resolveMetadataBase();

/** Resolves a site-relative path to an absolute URL against `metadataBase` — used for share-intent links, which (unlike Next's own metadata resolution) need a real string, not a field Next resolves internally. */
export function absoluteUrl(path: string): string {
  return new URL(path, metadataBase).toString();
}

export const SITE_NAME = "Vivetutiempo";

/**
 * Shared Open Graph / Twitter image: a 1200x630 crop of the homepage hero
 * photograph (`public/images/hero-cello-community-v2.png`), generated once
 * via `sharp` and committed as a static asset at `public/images/og-cover.jpg`.
 * One image, reused across every page — a deliberate product decision, not
 * an oversight: there is no per-page photograph to invent, and varying the
 * image per route would add asset-maintenance cost for no reader-facing
 * benefit on a site this size.
 */
const OG_IMAGE_PATH = "/images/og-cover.jpg";
const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** Open Graph locale tags are `language_TERRITORY`. Basque has no ISO territory code of its own in common OG usage; `eu_ES` (Basque, Spain) is the convention used by other Basque-language sites for the same reason `es_ES`/`en_US` are used here rather than a bare language code. */
const OG_LOCALE: Record<Locale, string> = {
  es: "es_ES",
  en: "en_US",
  eu: "eu_ES",
};

/**
 * Builds a full per-route `Metadata` object — title, description, Open
 * Graph, and Twitter card.
 *
 * Next.js does NOT deep-merge nested metadata objects across route
 * segments: a route that defines its own `openGraph` REPLACES the parent's
 * entirely (field by field, including `images`), it does not fill in only
 * the fields it omits. Left to each page, that means every one of them
 * would have to redeclare `siteName`, `locale`, and the shared image just
 * to avoid silently losing them — this helper centralises that so each
 * page only supplies what actually varies (title, description, path, alt
 * text).
 */
export async function buildPageMetadata({
  pageTitle,
  description,
  path,
  imageAlt,
}: {
  /** Page-specific portion of the `<title>` tag — the `Vivetutiempo — ` brand prefix is added here, once. */
  pageTitle: string;
  description: string;
  /** Route path relative to the site root, e.g. `"/events"`. Resolved to an absolute URL by Next via `metadataBase`. */
  path: string;
  imageAlt: string;
}): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const title = `${SITE_NAME} — ${pageTitle}`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale] ?? OG_LOCALE.es,
      url: path,
      title,
      description,
      images: [{ url: OG_IMAGE_PATH, ...OG_IMAGE_SIZE, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_PATH],
    },
  };
}
