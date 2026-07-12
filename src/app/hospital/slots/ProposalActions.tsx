"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButton, secondaryButton } from "@ui/components/ui";

type Action = "approve" | "reject";

/** Approve / reject a single Proposal against one of the Hospital's own Slots (5.6). */
export function ProposalActions({
  slotId,
  proposalId,
}: {
  slotId: string;
  proposalId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setError(null);
    setPending(action);
    try {
      const res = await fetch(
        `/api/slots/${slotId}/proposals/${proposalId}/${action}`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "The action could not be completed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("approve")}
          className={primaryButton}
        >
          {pending === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("reject")}
          className={secondaryButton}
        >
          {pending === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
      {error ? <p className="text-xs text-primary">{error}</p> : null}
    </div>
  );
}
