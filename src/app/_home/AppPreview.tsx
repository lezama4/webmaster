import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";

/**
 * Home "App — Coming soon" section. HONEST by construction: the phones are
 * pure-CSS CONCEPT mockups (no real screenshots, no working UI), and the
 * section carries an explicit "Próximamente" badge plus a concept disclaimer.
 * The platform's claim elsewhere is "it works today" (the web); this section
 * is clearly future/vision, never presented as a shipped feature.
 */

function Bar({ w, tone = "muted" }: { w: string; tone?: "muted" | "primary" | "strong" }) {
  const bg =
    tone === "primary" ? "bg-primary/70" : tone === "strong" ? "bg-foreground/70" : "bg-foreground/12";
  return <span className={`block h-2 rounded-full ${bg}`} style={{ width: w }} aria-hidden="true" />;
}

/** A concept phone: a device frame around a simplified, skeleton screen. */
function Phone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-[9/19] w-[200px] overflow-hidden rounded-[2.1rem] border-[6px] border-foreground/85 bg-background shadow-xl sm:w-[210px]">
        <span
          className="absolute left-1/2 top-2 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-foreground/25"
          aria-hidden="true"
        />
        <div className="flex h-full flex-col gap-3 px-3.5 pb-4 pt-7">{children}</div>
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

/** A small stand-in "card" inside a phone screen. */
function MiniCard({ accent = false }: { accent?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
      <Bar w="45%" tone={accent ? "primary" : "muted"} />
      <Bar w="85%" tone="strong" />
      <Bar w="60%" />
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
          {/* Screen 1 — discover events */}
          <Phone label={t("app.screen1")}>
            <Bar w="55%" tone="strong" />
            <MiniCard accent />
            <MiniCard />
            <MiniCard />
          </Phone>
          {/* Screen 2 — find your centre (a "map" band over a couple of rows) */}
          <Phone label={t("app.screen2")}>
            <Bar w="65%" tone="strong" />
            <div className="h-24 rounded-2xl border border-border bg-surface" aria-hidden="true" />
            <MiniCard />
            <MiniCard accent />
          </Phone>
          {/* Screen 3 — coordinate activities (a small "form") */}
          <Phone label={t("app.screen3")}>
            <Bar w="60%" tone="strong" />
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
              <Bar w="35%" />
              <div className="h-6 rounded-lg bg-foreground/8" aria-hidden="true" />
              <Bar w="35%" />
              <div className="h-6 rounded-lg bg-foreground/8" aria-hidden="true" />
            </div>
            <div className="mt-1 h-8 rounded-xl bg-primary/70" aria-hidden="true" />
          </Phone>
        </div>

        <p className="text-center text-xs text-muted">{t("app.disclaimer")}</p>
      </section>
    </Reveal>
  );
}
