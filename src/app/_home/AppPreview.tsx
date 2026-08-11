import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";

/**
 * Home "on mobile" section: three ACTUAL screenshots of this site's own pages
 * as they render on a phone, each shown edge to edge inside a device shell.
 *
 * Real captures rather than hand-drawn CSS imitations — those never matched
 * the pages' real typography, crop and proportions. They are NOT iframes of
 * the live pages either: `X-Frame-Options: DENY` and CSP
 * `frame-ancestors 'none'` are deliberate clickjacking controls
 * (next.config.ts / middleware.ts) that must not be relaxed for a decorative
 * preview.
 *
 * The captures are decorative here — every page they show is reachable from
 * this same site — hence the empty alt on each. Re-capture a file when its
 * page changes visually; the capture is a snapshot, not a live render.
 */

/** Device shell: bezel, notch, and a full-bleed screen holding one capture. */
function Phone({ label, src }: { label: string; src: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-[9/19] w-[196px] overflow-hidden rounded-[2.1rem] border-[7px] border-foreground/85 bg-background shadow-xl sm:w-[208px]">
        <span
          className="absolute left-1/2 top-2 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-foreground/25"
          aria-hidden="true"
        />
        <Image
          src={src}
          alt=""
          fill
          sizes="208px"
          className="object-cover object-top"
          aria-hidden="true"
        />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export async function AppPreview() {
  const t = await getTranslations("Home");

  return (
    <Reveal className="border-t border-border bg-surface-2">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 md:py-28">
        <div className="flex flex-col gap-4 md:max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-wide text-accent">{t("app.eyebrow")}</span>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-balance text-4xl font-normal leading-tight tracking-tight md:text-5xl">
              {t("app.title")}
            </h2>
            <span className="rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {t("app.badge")}
            </span>
          </div>
          <p className="max-w-[56ch] text-lg leading-relaxed text-muted">{t("app.description")}</p>
        </div>

        <div className="flex flex-wrap items-start justify-center gap-10 sm:gap-12">
          <Phone label={t("app.screenHome")} src="/images/home-mobile-snapshot.jpg" />
          <Phone label={t("app.screen1")} src="/images/events-mobile-snapshot.jpg" />
          <Phone label={t("app.screen2")} src="/images/centres-mobile-snapshot.jpg" />
        </div>

        <p className="text-center text-xs text-muted">{t("app.disclaimer")}</p>
      </section>
    </Reveal>
  );
}
