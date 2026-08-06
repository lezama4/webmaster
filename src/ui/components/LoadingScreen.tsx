/**
 * Route-level loading indicator (Next.js `loading.tsx`). Rendered instantly by
 * the App Router while a slow authed page's Server Components stream in — so a
 * cold serverless start + DB wake + argon2 login no longer looks frozen. Pure
 * CSS spinner (no JS, no i18n), locale-neutral, works in light and dark.
 */
export function LoadingScreen() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center"
      role="status"
      aria-label="Cargando"
    >
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-border border-t-primary" />
    </div>
  );
}
