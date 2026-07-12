"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButton, secondaryButton } from "@ui/components/ui";

type Action = "approve" | "reject";

const LABEL: Record<Action, string> = {
  approve: "Approve",
  reject: "Reject",
};

const PENDING_LABEL: Record<Action, string> = {
  approve: "Approving…",
  reject: "Rejecting…",
};

/**
 * Approve / reject actions for one Admin validation-queue row (5.3). The
 * queue holds only `pending` Profiles, so deactivation (an `active`-only
 * transition, 5.11) has no valid target here and is intentionally absent —
 * it belongs to a future active-profiles view. Each button POSTs to its
 * matching route and refreshes the queue on success; a failure is shown
 * inline rather than thrown away.
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
      </div>
      {error ? <p className="text-xs text-primary">{error}</p> : null}
    </div>
  );
}
