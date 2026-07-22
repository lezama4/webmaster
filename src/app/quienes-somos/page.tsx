import { getTranslations } from "next-intl/server";

type RoleItem = { name: string; description: string };

/**
 * Static, public `/quienes-somos` page (spec: public-information). Mirrors
 * `src/app/ayuda/page.tsx`'s layout conventions, but owns different content:
 * purpose, roles, the high-level flow, Admin validation, data stance, and
 * funding — NOT the step-by-step how-to copy `/ayuda` already owns (spec
 * scenario "Content ownership does not duplicate /ayuda").
 */
export default async function AboutPage() {
  const t = await getTranslations("About");

  const roles = t.raw("roles.items") as RoleItem[];
  const flowStages = t.raw("flow.stages") as string[];
  const excluded = t.raw("dataStance.excluded") as string[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3 pb-10">
        <span className="text-xs font-medium uppercase tracking-wide text-accent">{t("eyebrow")}</span>
        <h1 className="font-heading text-balance text-4xl font-normal tracking-tight md:text-5xl">{t("title")}</h1>
        <p className="max-w-[60ch] text-lg text-muted">{t("intro")}</p>
      </header>

      <section className="border-t border-border py-12">
        <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{t("purpose.title")}</h2>
        <p className="mt-3 max-w-[60ch] text-muted">{t("purpose.description")}</p>
      </section>

      <section className="border-t border-border py-12">
        <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{t("roles.title")}</h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2">
          {roles.map((role) => (
            <li key={role.name} className="flex flex-col gap-1 rounded-[20px] border border-border bg-surface p-5">
              <span className="font-medium">{role.name}</span>
              <span className="text-sm text-muted">{role.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border py-12">
        <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{t("flow.title")}</h2>
        <p className="mt-3 max-w-[60ch] text-muted">{t("flow.description")}</p>
        <ol className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-6">
          {flowStages.map((stage, index) => (
            <li key={stage} className="flex items-center gap-3">
              <span className="font-mono text-sm text-primary">{String(index + 1).padStart(2, "0")}</span>
              <span className="font-medium">{stage}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-border py-12">
        <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{t("validation.title")}</h2>
        <p className="mt-3 max-w-[60ch] text-muted">{t("validation.description")}</p>
      </section>

      <section className="border-t border-border py-12">
        <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{t("dataStance.title")}</h2>
        <p className="mt-3 max-w-[60ch] text-muted">{t("dataStance.description")}</p>
        <p className="mt-6 font-medium">{t("dataStance.excludedTitle")}</p>
        <ul className="mt-3 flex flex-col gap-2">
          {excluded.map((item) => (
            <li key={item} className="flex gap-2 text-muted">
              <span aria-hidden="true">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-[60ch] text-sm text-muted">{t("dataStance.note")}</p>
      </section>

      <section className="border-t border-border py-12">
        <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{t("funding.title")}</h2>
        <p className="mt-3 max-w-[60ch] text-muted">{t("funding.description")}</p>
      </section>
    </div>
  );
}
