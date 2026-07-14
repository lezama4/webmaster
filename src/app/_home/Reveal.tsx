"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type RevealState = "static" | "pending" | "visible";

/**
 * Fades a section in and lifts it a few pixels into place the first time it
 * scrolls into view. Subtle by design — a short, single fade + translateY,
 * no bounce or overshoot.
 *
 * Safety/perf notes:
 * - Renders fully visible with no inline style on the server and on first
 *   client paint (`static`), so there is no flash-of-invisible-content and
 *   no-JS visitors always see the full page.
 * - On mount, sections already inside the viewport stay `static` (skip the
 *   animation entirely) — only content below the fold gets the reveal.
 * - No-ops entirely under `prefers-reduced-motion: reduce`.
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RevealState>("static");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const rect = node.getBoundingClientRect();
    const alreadyInView = rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
    if (alreadyInView) return;

    setState("pending");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState("visible");
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined =
    state === "static"
      ? undefined
      : {
          transitionProperty: "opacity, transform",
          transitionDuration: "700ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          transitionDelay: `${delayMs}ms`,
          opacity: state === "visible" ? 1 : 0,
          transform: state === "visible" ? "translateY(0)" : "translateY(16px)",
        };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
