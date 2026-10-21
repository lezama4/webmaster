"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A form-level (not field-bound) error. `role="alert"` announces it and, because
 * it mounts only when an error appears, it also takes focus so keyboard and
 * screen-reader users land on the message after a failed submit. Field-bound
 * errors use `Field`'s `error` prop instead, which focuses the field itself.
 */
export function FormError({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <p ref={ref} role="alert" tabIndex={-1} className="text-sm text-danger">
      {children}
    </p>
  );
}
