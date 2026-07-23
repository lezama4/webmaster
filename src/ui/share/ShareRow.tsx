"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { buildShareLinks } from "./buildShareLinks";
import { CopyIcon, EmailIcon, LinkedInIcon, ShareIcon, TelegramIcon, WhatsAppIcon } from "./ShareIcons";

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

  // Circular icon buttons. The brand hue lives on hover/focus so the resting
  // row stays calm against the page; on interaction each control adopts its
  // network's colour. Size steps down in the compact (footer) placement.
  const size = compact ? "h-9 w-9" : "h-10 w-10";
  const iconSize = compact ? "h-4 w-4" : "h-5 w-5";
  const chip =
    "inline-flex items-center justify-center rounded-full border border-border bg-surface text-muted " +
    "transition-colors duration-150 hover:text-on-scrim focus-visible:text-on-scrim outline-none " +
    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const gapClasses = compact ? "gap-2" : "gap-2.5";

  return (
    <div className="flex flex-col gap-2">
      <ul className={`flex flex-wrap items-center ${gapClasses}`}>
        {canNativeShare ? (
          <li>
            <button
              type="button"
              onClick={handleNativeShare}
              aria-label={t("nativeShare")}
              title={t("nativeShare")}
              className={`${chip} ${size} hover:!bg-primary hover:!border-primary`}
            >
              <ShareIcon className={iconSize} />
            </button>
          </li>
        ) : (
          <>
            <li>
              <a
                href={links.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("whatsapp")}
                title={t("whatsapp")}
                className={`${chip} ${size} hover:!border-[#25D366] hover:!bg-[#25D366] focus-visible:!bg-[#25D366]`}
              >
                <WhatsAppIcon className={iconSize} />
              </a>
            </li>
            <li>
              <a
                href={links.telegram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("telegram")}
                title={t("telegram")}
                className={`${chip} ${size} hover:!border-[#26A5E4] hover:!bg-[#26A5E4] focus-visible:!bg-[#26A5E4]`}
              >
                <TelegramIcon className={iconSize} />
              </a>
            </li>
            <li>
              <a
                href={links.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("linkedin")}
                title={t("linkedin")}
                className={`${chip} ${size} hover:!border-[#0A66C2] hover:!bg-[#0A66C2] focus-visible:!bg-[#0A66C2]`}
              >
                <LinkedInIcon className={iconSize} />
              </a>
            </li>
            <li>
              <a
                href={links.email}
                aria-label={t("email")}
                title={t("email")}
                className={`${chip} ${size} hover:!bg-primary hover:!border-primary focus-visible:!bg-primary`}
              >
                <EmailIcon className={iconSize} />
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={handleCopy}
                aria-label={t("copyLink")}
                title={t("copyLink")}
                className={`${chip} ${size} hover:!bg-foreground hover:!border-foreground hover:!text-background focus-visible:!bg-foreground focus-visible:!text-background`}
              >
                <CopyIcon className={iconSize} />
              </button>
            </li>
          </>
        )}
      </ul>
      {/* Screen-reader feedback for the copy action — a copy button with no
          announcement is silent for anyone not watching the screen. */}
      <p aria-live="polite" aria-atomic="true" className="text-xs text-muted">
        {copyState === "copied" ? t("copied") : copyState === "error" ? t("copyError") : ""}
      </p>
    </div>
  );
}
