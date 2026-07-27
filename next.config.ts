import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Static security response headers applied to every route (Phase 7 hardening).
 * The per-request Content-Security-Policy is NOT here — it carries a fresh
 * nonce and is set in `src/middleware.ts`.
 *
 * - HSTS: force HTTPS for two years incl. subdomains (safe: the app is served
 *   over TLS on Vercel; browsers ignore it on plain-HTTP localhost).
 * - nosniff: forbid MIME sniffing.
 * - X-Frame-Options DENY: legacy clickjacking guard; the CSP `frame-ancestors
 *   'none'` is the modern equivalent, both are sent for defence in depth.
 * - Referrer-Policy: never leak a full path/query cross-origin.
 * - Permissions-Policy: switch off powerful features the app never uses.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), usb=(), magnetometer=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
