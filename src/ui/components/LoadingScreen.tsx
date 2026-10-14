import { getTranslations } from "next-intl/server";

/**
 * Route-level loading indicator (Next.js `loading.tsx`). Rendered instantly by
 * the App Router while a slow authed page's Server Components stream in — so a
 * cold serverless start + DB wake + argon2 login no longer looks frozen. Pure
 * CSS spinner; only the accessible name is localized. Works in light and dark.
 */
export async function LoadingScreen() {
  const t = await getTranslations("LoadingScreen");

  return (
    <div
      className="flex min-h-[60vh] items-center justify-center"
      role="status"
      aria-label={t("label")}
    >
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-border border-t-primary" />
    </div>
  );
}
