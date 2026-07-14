"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { primaryButton, secondaryButton } from "@ui/components/ui";

type Action = "approve" | "reject";

export function ProfileRowActions({ profileId }: { profileId: string }) {
  const t = useTranslations("ProfileActions");
  const router = useRouter(); const [pending, setPending] = useState<Action | null>(null); const [error, setError] = useState<string | null>(null);
  async function run(action: Action) {
    setError(null); setPending(action);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) { setError(t("error")); return; }
      router.refresh();
    } catch { setError(t("genericError")); } finally { setPending(null); }
  }
  return <div className="flex flex-col items-start gap-2 sm:items-end"><div className="flex flex-wrap gap-2"><button type="button" disabled={pending !== null} onClick={() => run("approve")} className={primaryButton}>{pending === "approve" ? t("approving") : t("approve")}</button><button type="button" disabled={pending !== null} onClick={() => run("reject")} className={secondaryButton}>{pending === "reject" ? t("rejecting") : t("reject")}</button></div>{error ? <p className="text-xs text-danger">{error}</p> : null}</div>;
}
