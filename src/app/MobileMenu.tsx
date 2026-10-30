"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Phone-width navigation: a single "Menu" disclosure button and a panel with
 * the links (server-rendered by the layout and passed as `children`). Hidden
 * from md up, where the full nav is shown instead, so only one named
 * landmark is ever exposed.
 */
export function MobileMenu({ label, navLabel, children }: { label: string; navLabel: string; children: ReactNode }) {
  const pathname = usePathname();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Remembering WHERE it was opened closes the menu on any route change
  // without a setState-in-effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenedAt(null);
      buttonRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <nav aria-label={navLabel} className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenedAt(open ? null : pathname)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
        </svg>
        {label}
      </button>
      <div
        id={panelId}
        hidden={!open}
        // A link click that stays on the same route does not change the
        // pathname, so close on any in-panel link activation too.
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpenedAt(null);
        }}
        className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-border bg-background px-4 pb-4 pt-2 shadow-sm sm:px-6"
      >
        {children}
      </div>
    </nav>
  );
}
