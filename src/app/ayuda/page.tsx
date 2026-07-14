import { getTranslations } from "next-intl/server";

type FaqItem = { question: string; answer: string };

export default async function HelpPage() {
  const t = await getTranslations("Help");

  const steps = ["01", "02", "03", "04"].map((number) => ({
    number,
    role: t(`steps.${number}.role`),
    text: t(`steps.${number}.text`),
  }));
  const faqItems = t.raw("faq.items") as FaqItem[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3 pb-10">
        <span className="text-xs font-medium uppercase tracking-wide text-accent">{t("eyebrow")}</span>
        <h1 className="font-heading text-balance text-4xl font-normal tracking-tight md:text-5xl">{t("title")}</h1>
        <p className="max-w-[52ch] text-lg text-muted">{t("intro")}</p>
      </header>

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

      <section className="border-t border-border py-16 md:py-20">
        <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{t("faq.title")}</h2>
        <div className="mt-8 flex flex-col divide-y divide-border">
          {faqItems.map((item) => (
            <details key={item.question} className="group py-5 first:pt-0 last:pb-0">
              <summary className="cursor-pointer list-none font-medium marker:content-none">
                <span className="flex items-center justify-between gap-4">
                  {item.question}
                  <span aria-hidden="true" className="text-muted transition-transform duration-150 group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 max-w-[65ch] text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
