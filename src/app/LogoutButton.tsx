"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Ends the session. Until this existed the app had no way out at all: the
 * `POST /api/auth/logout` route was implemented and revoked the session row
 * server-side (ADR D7 — logout is a DELETE, not merely a cookie clear), but
 * nothing in the interface ever called it, so a signed-in visitor could only
 * leave by deleting the cookie by hand.
 *
 * A same-origin `POST` carries an `Origin` header, which is what the route's
 * canonical-origin CSRF guard checks — no token plumbing is needed here.
 * After it resolves, the router is refreshed so the server re-renders the
 * header in its signed-out state.
 */
export function LogoutButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch {
      // The route is idempotent and the cookie may already be gone; a failed
      // request should still land the visitor somewhere sane rather than
      // leaving the button stuck.
      router.replace("/");
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={handleLogout} disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}
