"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { secondaryButton } from "@ui/components/ui";

export function CloseSlotButton({ slotId }: { slotId: string }) {
  const t = useTranslations("CloseSlot");
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function onClose() {
    setError(null); setPending(true);
    try {
      const res = await fetch(`/api/slots/${slotId}/close`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) { setError(t("error")); return; }
      router.refresh();
    } catch { setError(t("genericError")); } finally { setPending(false); }
  }
  return <div className="flex flex-col items-start gap-2 sm:items-end"><button type="button" disabled={pending} onClick={onClose} className={secondaryButton}>{pending ? t("closing") : t("submit")}</button>{error ? <p className="text-xs text-primary">{error}</p> : null}</div>;
}
