import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";

/**
 * Home "App — Coming soon" section.
 *
 * The FIRST phone is a faithful snapshot of the site's own home page as it
 * renders on mobile TODAY — the real hero image, badge and title — because
 * that page is shipped and works on mobile. The other two phones are pure-CSS
 * CONCEPT mockups of not-yet-built native app screens (an events feed, a map
 * with pins, a bottom tab bar), drawn from decorative shapes, not real
 * screenshots. The section keeps its explicit "Próximamente" badge and concept
 * disclaimer, which apply to those FUTURE app screens; the home snapshot is
 * clearly the real, current site.
 */

const STAR = "★";

function Stars({ filled }: { filled: number }) {
  return (
    <span className="text-[9px] leading-none tracking-tight" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={i < filled ? "text-[#e0a24a]" : "text-foreground/20"}>
          {STAR}
        </span>
      ))}
    </span>
  );
}

function Bar({ w, tone = "muted" }: { w: string; tone?: "muted" | "strong" | "primary" }) {
  const bg = tone === "primary" ? "bg-primary/70" : tone === "strong" ? "bg-foreground/75" : "bg-foreground/15";
  return <span className={`block h-1.5 rounded-full ${bg}`} style={{ width: w }} aria-hidden="true" />;
}

/** A small pill (date chip / type chip). */
function Chip({ tone = "primary" }: { tone?: "primary" | "accent" }) {
  const c = tone === "accent" ? "bg-accent/20 text-accent" : "bg-primary/18 text-primary";
  return (
    <span className={`inline-flex h-3.5 w-10 items-center rounded-full ${c}`} aria-hidden="true">
      <span className="mx-auto h-1 w-6 rounded-full bg-current opacity-70" />
    </span>
  );
}

/** A tiny event card: date chip, title, artist row, rating. */
function EventCard({ filled }: { filled: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-2.5">
      <div className="flex items-center justify-between">
        <Chip />
        <Stars filled={filled} />
      </div>
      <Bar w="88%" tone="strong" />
      <div className="flex items-center gap-1.5 pt-0.5">
        <span className="h-4 w-4 rounded-full bg-accent/40" aria-hidden="true" />
        <Bar w="45%" />
      </div>
    </div>
  );
}

/** Bottom tab bar with three simple icons; the first is active. */
function TabBar() {
  const icon = "h-4 w-4";
  return (
    <div className="mt-auto flex items-center justify-around border-t border-border pt-2">
      <svg viewBox="0 0 24 24" className={`${icon} text-primary`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <svg viewBox="0 0 24 24" className={`${icon} text-foreground/35`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="2.5" />
      </svg>
      <svg viewBox="0 0 24 24" className={`${icon} text-foreground/35`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    </div>
  );
}

/**
 * Device shell: bezel, notch, screen content. `bleed` renders the child
 * full-screen (no app header / tab bar / padding) so the home phone can show a
 * real edge-to-edge page snapshot; the default adds the app chrome the concept
 * app screens use.
 */
function Phone({ label, children, bleed = false }: { label: string; children: React.ReactNode; bleed?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-[9/19] w-[196px] overflow-hidden rounded-[2.1rem] border-[7px] border-foreground/85 bg-background shadow-xl sm:w-[208px]">
        <span className="absolute left-1/2 top-2 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-foreground/25" aria-hidden="true" />
        {bleed ? (
          <div className="absolute inset-0">{children}</div>
        ) : (
          <div className="flex h-full flex-col px-3 pb-3 pt-6">
            {/* status bar */}
            <div className="flex items-center justify-between px-0.5 pb-2">
              <span className="text-[9px] font-semibold text-foreground/50">9:41</span>
              <span className="flex items-center gap-0.5" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
                <span className="h-1.5 w-3 rounded-[3px] bg-foreground/30" />
              </span>
            </div>
            {/* app header */}
            <div className="flex items-center gap-2 pb-3">
              <span className="h-4 w-4 rounded-md bg-primary" aria-hidden="true" />
              <Bar w="42%" tone="strong" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2.5">{children}</div>
            <TabBar />
          </div>
        )}
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
          {/* Screen 0 — home: a REAL snapshot of the site's home on mobile,
              edge to edge — the actual hero image, badge and title. */}
          <Phone label={t("app.screenHome")} bleed>
            <Image
              src="/images/hero-cello-community-v2.png"
              alt=""
              fill
              sizes="208px"
              className="object-cover object-[72%_50%]"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-scrim/95 via-scrim/40 to-scrim/25" aria-hidden="true" />
            {/* status bar over the image */}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-2.5">
              <span className="text-[9px] font-semibold text-on-scrim/90">9:41</span>
              <span className="flex items-center gap-0.5" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-on-scrim/60" />
                <span className="h-1.5 w-1.5 rounded-full bg-on-scrim/60" />
                <span className="h-1.5 w-3 rounded-[3px] bg-on-scrim/60" />
              </span>
            </div>
            {/* hero copy at the bottom, exactly as the real home */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3.5">
              <span className="w-fit rounded-full border border-on-scrim/25 bg-on-scrim/10 px-2 py-0.5 text-[7px] font-medium leading-tight text-on-scrim backdrop-blur-sm">
                {t("badge")}
              </span>
              <p className="font-heading text-[14px] font-normal leading-[1.1] tracking-tight text-on-scrim">
                {t("title.firstLine")}
                <br />
                {t("title.secondLine")}
              </p>
            </div>
          </Phone>

          {/* Screen 1 — discover events: a feed of event cards with ratings */}
          <Phone label={t("app.screen1")}>
            <EventCard filled={5} />
            <EventCard filled={4} />
            <EventCard filled={5} />
          </Phone>

          {/* Screen 2 — find your centre: a map with pins + a result card */}
          <Phone label={t("app.screen2")}>
            <div className="relative h-32 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/10 via-surface to-accent/10">
              <span className="absolute left-6 top-8 h-3 w-3 rounded-full border-2 border-background bg-primary shadow" aria-hidden="true" />
              <span className="absolute left-20 top-14 h-3 w-3 rounded-full border-2 border-background bg-accent shadow" aria-hidden="true" />
              <span className="absolute left-12 top-20 h-3 w-3 rounded-full border-2 border-background bg-primary shadow" aria-hidden="true" />
              <span className="absolute right-6 top-10 h-3 w-3 rounded-full border-2 border-background bg-accent shadow" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5">
              <span className="h-8 w-8 flex-shrink-0 rounded-lg bg-primary/15" aria-hidden="true" />
              <div className="flex flex-col gap-1.5">
                <Bar w="70%" tone="strong" />
                <Chip tone="accent" />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5">
              <span className="h-8 w-8 flex-shrink-0 rounded-lg bg-accent/15" aria-hidden="true" />
              <div className="flex flex-col gap-1.5">
                <Bar w="60%" tone="strong" />
                <Chip />
              </div>
            </div>
          </Phone>
        </div>

        <p className="text-center text-xs text-muted">{t("app.disclaimer")}</p>
      </section>
    </Reveal>
  );
}
