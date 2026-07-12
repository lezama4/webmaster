"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButton, secondaryButton } from "@ui/components/ui";

type Action = "approve" | "reject" | "deactivate";

const LABEL: Record<Action, string> = {
  approve: "Approve",
  reject: "Reject",
  deactivate: "Deactivate",
};

const PENDING_LABEL: Record<Action, string> = {
  approve: "Approving…",
  reject: "Rejecting…",
  deactivate: "Deactivating…",
};

/**
 * Approve / reject / deactivate actions for one Admin queue row (5.3/5.11).
 * Each button POSTs to its matching route and refreshes the queue on
 * success; a failure (e.g. a still-pending Profile cannot be deactivated
 * yet) is shown inline rather than thrown away.
 */
export function ProfileRowActions({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setError(null);
    setPending(action);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
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
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("approve")}
          className={primaryButton}
        >
          {pending === "approve" ? PENDING_LABEL.approve : LABEL.approve}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("reject")}
          className={secondaryButton}
        >
          {pending === "reject" ? PENDING_LABEL.reject : LABEL.reject}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("deactivate")}
          className={secondaryButton}
        >
          {pending === "deactivate" ? PENDING_LABEL.deactivate : LABEL.deactivate}
        </button>
      </div>
      {error ? <p className="text-xs text-primary">{error}</p> : null}
    </div>
  );
}
