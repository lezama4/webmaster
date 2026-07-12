"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputClasses, primaryButton, secondaryButton } from "@ui/components/ui";

/**
 * "Propose an activity" action for one open Slot (5.5) — starts collapsed as
 * a single button; expands into a message field on click, POSTs to
 * `/api/slots/[id]/proposals`, and shows a confirmation once accepted by the
 * server (the Slot itself stays `open` in the listing until the Hospital
 * decides, so a refetch alone would not communicate the submission).
 */
export function ProposeActivityForm({ slotId }: { slotId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/slots/${slotId}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(
          res.status === 409
            ? "You already sent a proposal for this slot."
            : body?.error ?? "The proposal could not be sent. Please try again.",
        );
        return;
      }
      setSent(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <p className="text-sm font-medium text-primary">
        Proposal sent — the hospital will review it.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={primaryButton}
      >
        Propose an activity
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <Field
        label="Your proposal"
        htmlFor={`message-${slotId}`}
        hint="What will you bring to this moment?"
        error={error ?? undefined}
      >
        <textarea
          id={`message-${slotId}`}
          name="message"
          required
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputClasses}
        />
      </Field>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Sending…" : "Send proposal"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className={secondaryButton}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
