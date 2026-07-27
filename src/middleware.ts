import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content-Security-Policy with a fresh nonce (Phase 7 hardening).
 *
 * A nonce cannot be static (it must be unpredictable per response), so the CSP
 * lives here rather than in `next.config.ts` alongside the static headers.
 * Next.js reads the nonce from the request-side CSP header and stamps its own
 * bootstrap/hydration scripts with it, so `script-src` needs neither
 * `'unsafe-inline'` nor a host allow-list — `'strict-dynamic'` lets those
 * trusted scripts load the rest of the bundle.
 *
 * `style-src 'unsafe-inline'` is retained deliberately: Tailwind and
 * `next/font` inject inline `<style>`/`@font-face` blocks, and inline styles
 * are a far weaker XSS vector than inline scripts. Fonts are self-hosted by
 * `next/font/google` at build time, so `font-src 'self'` suffices with no
 * request to Google at runtime. The app loads no third-party scripts, frames,
 * maps or tile servers, so every other directive can stay `'self'`.
 *
 * `'unsafe-eval'` is added ONLY in development, where the Next dev server uses
 * eval for hot-module replacement; production builds never eval, so the
 * deployed policy stays strict.
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = `'self' 'nonce-${nonce}' 'strict-dynamic'${
    isDev ? " 'unsafe-eval'" : ""
  }`;

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  // Set the CSP on the REQUEST headers too: this is how Next.js discovers the
  // nonce and applies it to the scripts it renders.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Apply to page routes only. Static assets, image optimiser, API JSON and the
  // favicon do not render nonce-bearing scripts; skipping prefetches avoids
  // burning a nonce on a request whose response is never committed.
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
