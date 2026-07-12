"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputClasses, primaryButton } from "@ui/components/ui";

const EMPTY_FORM = {
  title: "",
  description: "",
  scheduledAt: "",
  durationMinutes: "60",
  location: "",
};

/** Hospital "publish a slot" form (5.4) — POSTs to `/api/slots`, resets on success. */
export function PublishSlotForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          scheduledAt: form.scheduledAt,
          durationMinutes: Number(form.durationMinutes),
          location: form.location,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "The slot could not be published. Check the details and try again.");
        return;
      }
      setForm(EMPTY_FORM);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-6 shadow-[0_16px_40px_-28px_rgba(42,33,28,0.35)]"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Publish a slot</h2>
        <p className="text-sm text-muted">
          Open a moment in the ward&apos;s agenda for artists to propose an activity.
        </p>
      </div>

      <Field label="Title" htmlFor="title">
        <input
          id="title"
          name="title"
          type="text"
          required
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          className={inputClasses}
        />
      </Field>
      <Field label="Description" htmlFor="description">
        <textarea
          id="description"
          name="description"
          required
          rows={3}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          className={inputClasses}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date and time" htmlFor="scheduledAt">
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            required
            value={form.scheduledAt}
            onChange={(e) => update("scheduledAt", e.target.value)}
            className={inputClasses}
          />
        </Field>
        <Field label="Duration (minutes)" htmlFor="durationMinutes">
          <input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={1}
            required
            value={form.durationMinutes}
            onChange={(e) => update("durationMinutes", e.target.value)}
            className={inputClasses}
          />
        </Field>
      </div>
      <Field
        label="Location"
        htmlFor="location"
        hint="Visible to registered artists browsing this slot — never shown on the public events page."
        error={error ?? undefined}
      >
        <input
          id="location"
          name="location"
          type="text"
          required
          value={form.location}
          onChange={(e) => update("location", e.target.value)}
          className={inputClasses}
        />
      </Field>

      <button type="submit" disabled={pending} className={`${primaryButton} mt-2 self-start`}>
        {pending ? "Publishing…" : "Publish slot"}
      </button>
    </form>
  );
}
