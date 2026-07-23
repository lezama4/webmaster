import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { primaryButton, secondaryButton } from "@ui/components/ui";
import { Reveal } from "./_home/Reveal";
import { StarRating } from "./StarRating";

type ArtistItem = { name: string; role: string; quote: string; rating: number };
type ReviewItem = { quote: string; author: string; context: string; rating: number };

export default async function Home() {
  const t = await getTranslations("Home");

  const hospitals = t.raw("trust.hospitals") as string[];
  const patrons = t.raw("trust.patrons") as string[];
  const artists = t.raw("artists.items") as ArtistItem[];
  const reviews = t.raw("reviews.items") as ReviewItem[];
  const whatSteps = t.raw("what.steps") as string[];

  return (
    <div className="flex flex-col">
      {/* 1. Hero — large, full-bleed image with a big serif statement overlaid.
          Deliberately short of a full viewport: the "what this is" block below
          must break the fold, or a first-time visitor sees only the emotional
          statement and never learns what the platform does. Sized so the next
          section's eyebrow and heading are READ, not merely glimpsed: its own
          top padding is 112px, so the hero has to stop well short of the
          viewport for any of that section's text to clear the fold. The hero
          carries no call to action — the ones that matter live in the block
          below, where the reader already knows what they are choosing. */}
      <section className="relative isolate flex min-h-[54vh] items-end overflow-hidden sm:min-h-[58vh]">
        <Image
          src="/images/hero-cello-community-v2.png"
          alt={t("hero.imageAlt")}
          fill
          priority
          sizes="100vw"
          /* The cellist — the emotional subject — sits at ~77% of the image
             width. A portrait phone crops ~40% of a landscape hero, and
             centred `object-cover` cuts her out entirely, leaving only the
             audience. Bias the focal point right on mobile so she stays in
             frame; on sm+ the hero box is wide enough to show the whole scene,
             so recentre. */
          className="object-cover object-[72%_50%] sm:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-scrim/90 via-scrim/40 to-scrim/10" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-14 pt-28 sm:px-6 sm:pb-20">
          <span className="w-fit rounded-full border border-on-scrim/25 bg-on-scrim/10 px-3 py-1 text-xs font-medium text-on-scrim backdrop-blur-sm">
            {t("badge")}
          </span>
          <h1 className="font-heading max-w-3xl text-balance text-5xl font-normal leading-[1.05] tracking-tight text-on-scrim md:text-7xl">
            {t("title.firstLine")}
            <br />
            {t("title.secondLine")}
          </h1>
          <p className="max-w-[52ch] text-lg leading-relaxed text-on-scrim/85">{t("description")}</p>
        </div>
      </section>

      {/* 1.5 What we do — the clarity block. States what the platform does,
          that it's free/non-profit, and the 3-step flow; links to
          /quienes-somos for depth. Sits between Hero (h1) and Mission (h2),
          so its own heading is an h2 — no skipped level. */}
      <Reveal className="border-t border-border">
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 md:py-28">
          <div className="flex flex-col gap-4 md:max-w-2xl">
            <span className="text-xs font-medium uppercase tracking-wide text-accent">{t("what.eyebrow")}</span>
            <h2 className="font-heading text-balance text-4xl font-normal leading-tight tracking-tight md:text-5xl">
              {t("what.title")}
            </h2>
            <p className="max-w-[56ch] text-lg leading-relaxed text-muted">{t("what.description")}</p>
          </div>
          <ol className="grid gap-6 border-t border-border pt-8 sm:grid-cols-3">
            {whatSteps.map((step, index) => (
              <li key={step} className="flex flex-col gap-2">
                <span className="font-mono text-sm text-primary">{String(index + 1).padStart(2, "0")}</span>
                <span className="font-medium">{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/events" className={primaryButton}>
              {t("what.primaryCta")}
            </Link>
            <Link
              href="/quienes-somos"
              className="text-sm font-medium text-foreground underline underline-offset-4 transition-colors duration-150 hover:text-accent"
            >
              {t("what.secondaryCta")}
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        </section>
      </Reveal>

      {/* 2. Mission — the emotional "why". */}
      <Reveal className="border-t border-border">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2 md:items-center md:gap-16 md:py-28">
          <div className="flex flex-col gap-5">
            <span className="text-xs font-medium uppercase tracking-wide text-accent">{t("mission.eyebrow")}</span>
            <h2 className="font-heading text-balance text-4xl font-normal leading-tight tracking-tight md:text-5xl">
              {t("mission.title")}
            </h2>
            <p className="max-w-[48ch] text-lg leading-relaxed text-muted">{t("mission.description")}</p>
          </div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px]">
            <Image
              src="/images/community-workshop.png"
              alt={t("mission.imageAlt")}
              fill
              sizes="(min-width: 768px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
        </section>
      </Reveal>

      {/* 3. Institutional trust — the one deep/dark section, for gravity and seriousness. */}
      <Reveal>
        <section className="bg-foreground py-20 text-background md:py-28">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6">
            <div className="flex flex-col gap-4 md:max-w-2xl">
              <span className="text-xs font-medium uppercase tracking-wide text-accent">{t("trust.eyebrow")}</span>
              <h2 className="font-heading text-balance text-4xl font-normal leading-tight tracking-tight md:text-5xl">
                {t("trust.title")}
              </h2>
              <p className="max-w-[56ch] text-background/75">{t("trust.description")}</p>
            </div>
            <div className="grid gap-10 border-t border-background/15 pt-10 sm:grid-cols-2">
              <div className="flex flex-col gap-3">
                <span className="text-xs font-medium uppercase tracking-wide text-background/50">
                  {t("trust.hospitalsLabel")}
                </span>
                <ul className="flex flex-col divide-y divide-background/10">
                  {hospitals.map((name) => (
                    <li key={name} className="py-2.5 font-heading text-xl first:pt-0">
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-xs font-medium uppercase tracking-wide text-background/50">
                  {t("trust.patronsLabel")}
                </span>
                <ul className="flex flex-col divide-y divide-background/10">
                  {patrons.map((name) => (
                    <li key={name} className="py-2.5 font-heading text-xl first:pt-0">
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="max-w-[64ch] text-xs text-background/50">{t("trust.disclaimer")}</p>
          </div>
        </section>
      </Reveal>

      {/* 4. Top-rated artists. */}
      <Reveal>
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="mb-10 flex flex-col gap-4 md:max-w-2xl">
            <span className="text-xs font-medium uppercase tracking-wide text-accent">{t("artists.eyebrow")}</span>
            <h2 className="font-heading text-balance text-4xl font-normal leading-tight tracking-tight md:text-5xl">
              {t("artists.title")}
            </h2>
            <p className="text-muted">{t("artists.description")}</p>
          </div>
          <ul className="grid gap-10 border-t border-border sm:grid-cols-2 sm:divide-x sm:divide-border">
            {artists.map((artist) => (
              <li key={artist.name} className="flex flex-col gap-3 pt-8 sm:px-8 sm:first:pl-0 sm:last:pr-0">
                <StarRating rating={artist.rating} label={t("ariaRating", { rating: artist.rating })} />
                <p className="font-heading text-xl leading-snug text-balance">&ldquo;{artist.quote}&rdquo;</p>
                <div>
                  <p className="font-medium">{artist.name}</p>
                  <p className="text-sm text-muted">{artist.role}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-xs text-muted">{t("artists.disclaimer")}</p>
        </section>
      </Reveal>

      {/* 5. Voices / reviews — beside the choir image. */}
      <Reveal className="border-t border-border">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.1fr] md:items-center md:gap-16 md:py-28">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px]">
            <Image
              src="/images/community-choir-audience-integrated-v2.png"
              alt={t("reviews.imageAlt")}
              fill
              sizes="(min-width: 768px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-medium uppercase tracking-wide text-accent">{t("reviews.eyebrow")}</span>
              <h2 className="font-heading text-balance text-4xl font-normal leading-tight tracking-tight md:text-5xl">
                {t("reviews.title")}
              </h2>
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {reviews.map((review) => (
                <li key={review.author} className="flex flex-col gap-2 py-6 first:pt-0 last:pb-0">
                  <StarRating rating={review.rating} label={t("ariaRating", { rating: review.rating })} />
                  <p className="text-lg leading-relaxed">&ldquo;{review.quote}&rdquo;</p>
                  <p className="text-sm text-muted">
                    {review.author} · {review.context}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{t("reviews.disclaimer")}</p>
          </div>
        </section>
      </Reveal>

      {/* 6. Closing CTA. */}
      <Reveal className="border-t border-border bg-surface-2">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6 md:flex-row md:items-center md:justify-between md:py-24">
          <div className="flex flex-col gap-3 md:max-w-xl">
            <h2 className="font-heading text-balance text-4xl font-normal leading-tight tracking-tight md:text-5xl">
              {t("closing.title")}
            </h2>
            <p className="text-muted">{t("closing.description")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className={primaryButton}>
              {t("closing.primaryCta")}
            </Link>
            <Link href="/events" className={secondaryButton}>
              {t("closing.secondaryCta")}
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
