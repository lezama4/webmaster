"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { secondaryButton } from "@ui/components/ui";

/** Owner-Hospital-only Slot withdrawal (5.10, B2) — closes the Slot and cascade-rejects outstanding Proposals. */
export function CloseSlotButton({ slotId }: { slotId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClose() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/slots/${slotId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "The slot could not be closed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        disabled={pending}
        onClick={onClose}
        className={secondaryButton}
      >
        {pending ? "Closing…" : "Close slot"}
      </button>
      {error ? <p className="text-xs text-primary">{error}</p> : null}
    </div>
  );
}
