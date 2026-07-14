import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("Home");
  const steps = ["01", "02", "03", "04"].map((number) => ({
    number,
    role: t(`steps.${number}.role`),
    text: t(`steps.${number}.text`),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid items-center gap-10 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
        <div className="flex flex-col items-start gap-6">
          <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted">{t("badge")}</span>
          <h1 className="font-heading text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            {t("title.firstLine")}
            <br />
            <span className="text-primary">{t("title.secondLine")}</span>
          </h1>
          <p className="max-w-[52ch] text-lg leading-relaxed text-muted">{t("description")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/events" className="rounded-[13px] bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:translate-y-px">
              {t("browseEvents")}
            </Link>
            <Link href="/register" className="rounded-[13px] border border-border bg-surface px-6 py-3 text-sm font-semibold transition-colors duration-150 hover:border-foreground/30 active:translate-y-px">
              {t("registerProfile")}
            </Link>
          </div>
        </div>

        <div className="relative aspect-square w-full">
          <div className="absolute inset-0 rounded-[20px] bg-surface-2" />
          <div className="absolute left-6 top-8 h-40 w-40 rounded-[20px] bg-primary/15" />
          <div className="absolute bottom-10 right-8 h-48 w-48 rounded-full bg-accent/20" />
          <div className="absolute inset-x-10 bottom-12 top-16 rounded-[20px] border border-border bg-surface shadow-[0_24px_48px_-24px_rgba(42,33,28,0.25)]" />
          <div className="absolute inset-x-16 bottom-20 top-24 flex flex-col justify-end gap-2">
            <span className="h-2 w-2/3 rounded-full bg-primary/40" />
            <span className="h-2 w-1/2 rounded-full bg-foreground/10" />
            <span className="h-2 w-3/5 rounded-full bg-foreground/10" />
          </div>
        </div>
      </section>

      <section className="grid gap-10 border-t border-border py-16 md:grid-cols-[0.8fr_1.2fr] md:py-20">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{t("howItWorks.title")}</h2>
          <p className="mt-3 max-w-[40ch] text-muted">{t("howItWorks.description")}</p>
        </div>
        <ol className="divide-y divide-border">
          {steps.map((step) => (
            <li key={step.number} className="flex gap-5 py-5 first:pt-0 last:pb-0">
              <span className="font-mono text-sm text-primary">{step.number}</span>
              <div className="flex flex-col gap-1">
                <span className="font-medium">{step.role}</span>
                <span className="text-muted">{step.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
