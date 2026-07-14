import type { ReactNode } from "react";

/** Primary call-to-action styling (sage, tactile push on :active). */
export const primaryButton =
  "inline-flex items-center justify-center rounded-[13px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

/** Secondary / neutral button styling. */
export const secondaryButton =
  "inline-flex items-center justify-center rounded-[13px] border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-surface-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

/** Shared input styling — used by form fields across the auth and dashboard pages. Focus ring comes from the global `*:focus-visible` accent outline. */
export const inputClasses =
  "w-full rounded-[8px] border border-border bg-surface px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted";

/** A labelled form control: label above, control (children) in the middle, hint or error below. Errors use the semantic danger token, not the brand accent. */
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
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** A composed empty state — used when a list has no data yet. */
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
    <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border bg-surface-2 px-6 py-16 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="max-w-[42ch] text-muted">{description}</p>
      {action}
    </div>
  );
}
