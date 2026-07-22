"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { buildShareLinks } from "./buildShareLinks";

type CopyState = "idle" | "copied" | "error";

/** `navigator.share` never appears or disappears after mount, so there is
 * nothing to subscribe to — this is a no-op subscription, required by
 * `useSyncExternalStore`'s signature. */
function subscribeToNothing(): () => void {
  return () => {};
}

function getNativeShareSnapshot(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** Always `false` on the server: `navigator` does not exist there, and
 * matching the client's eventual value is unnecessary — this is exactly
 * the value a first client render before hydration would compute too. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * A page-level share affordance (product decision, not artefact-level —
 * `PublicEventProjection`/`PublicHospitalProjection` carry no public id and
 * there is no `/events/[id]` route, so there is nothing to deep-link to;
 * see ADR D10). No third-party script ever loads here: every network is a
 * plain `<a href>` share-intent URL (`buildShareLinks`) that makes no
 * request until the visitor clicks it.
 *
 * Progressive enhancement: `navigator.share` is detected at runtime via
 * `useSyncExternalStore`, not by user-agent sniffing (desktop browsers on
 * some OSes expose it too, and some mobile browsers do not) and not via a
 * `useEffect` + `setState` pair (an extra render for a value that never
 * changes after mount). Server-rendered/pre-hydration markup always shows
 * the explicit fallback links, which are fully functional without
 * JavaScript; once hydrated on a capable browser it swaps to a single
 * native-share button.
 */
export function ShareRow({
  url,
  title,
  text,
  compact = false,
}: {
  /** Absolute URL of the page being shared. */
  url: string;
  /** OS share-sheet title and email subject. */
  title: string;
  /** Share message body. The caller owns D10 compliance for this string. */
  text: string;
  /** Smaller type/spacing for the site-wide footer placement. */
  compact?: boolean;
}) {
  const t = useTranslations("Share");
  const canNativeShare = useSyncExternalStore(subscribeToNothing, getNativeShareSnapshot, getServerSnapshot);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function handleNativeShare() {
    try {
      await navigator.share({ title, text, url });
    } catch {
      // AbortError (the visitor cancelled the share sheet) or any other
      // share failure: the OS share sheet already gave its own feedback,
      // there is nothing useful to surface here.
    }
  }

  async function handleCopy() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  const links = buildShareLinks({ url, title, text });
  const linkClasses = "text-muted underline underline-offset-4 transition-colors hover:text-foreground";
  const gapClasses = compact ? "gap-x-4 gap-y-1 text-xs" : "gap-x-5 gap-y-2 text-sm";

  return (
    <div className="flex flex-col gap-2">
      <div className={`flex flex-wrap items-center ${gapClasses}`}>
        {canNativeShare ? (
          <button type="button" onClick={handleNativeShare} className={linkClasses}>
            {t("nativeShare")}
          </button>
        ) : (
          <>
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={linkClasses}>
              {t("whatsapp")}
            </a>
            <a href={links.telegram} target="_blank" rel="noopener noreferrer" className={linkClasses}>
              {t("telegram")}
            </a>
            <a href={links.linkedin} target="_blank" rel="noopener noreferrer" className={linkClasses}>
              {t("linkedin")}
            </a>
            <a href={links.email} className={linkClasses}>
              {t("email")}
            </a>
            <button type="button" onClick={handleCopy} className={linkClasses}>
              {t("copyLink")}
            </button>
          </>
        )}
      </div>
      {/* Screen-reader feedback for the copy action — a copy button with no
          announcement is silent for anyone not watching the screen. */}
      <p aria-live="polite" aria-atomic="true" className="text-xs text-muted">
        {copyState === "copied" ? t("copied") : copyState === "error" ? t("copyError") : ""}
      </p>
    </div>
  );
}
