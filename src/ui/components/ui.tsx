import type { ReactNode } from "react";

/** Primary call-to-action styling (terracotta, tactile push on :active). */
export const primaryButton =
  "inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-all hover:bg-primary-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

/** Secondary / neutral button styling. */
export const secondaryButton =
  "inline-flex items-center justify-center rounded-full border border-border bg-surface px-5 py-2.5 font-medium transition-all hover:border-foreground/30 active:translate-y-px disabled:opacity-60";

/** Shared input styling — used by form fields across the auth and dashboard pages. */
export const inputClasses =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary";

/** A labelled form control: label above, control (children) in the middle, hint or error below (design rule — forms). */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-primary">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** A composed empty state — used when a list has no data yet (design rule — empty states). */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-surface-2 px-6 py-16 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="max-w-[42ch] text-muted">{description}</p>
      {action}
    </div>
  );
}
