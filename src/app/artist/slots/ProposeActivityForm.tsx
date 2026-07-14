"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputClasses, primaryButton, secondaryButton } from "@ui/components/ui";

export function ProposeActivityForm({ slotId }: { slotId: string }) {
  const t = useTranslations("ProposeActivity");
  const router = useRouter(); const [open, setOpen] = useState(false); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const [sent, setSent] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setPending(true);
    try {
      const res = await fetch(`/api/slots/${slotId}/proposals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      if (!res.ok) { setError(res.status === 409 ? t("errors.duplicate") : t("errors.failure")); return; }
      setSent(true); router.refresh();
    } catch { setError(t("errors.generic")); } finally { setPending(false); }
  }
  if (sent) return <p className="text-sm font-medium text-success">{t("sent")}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={primaryButton}>{t("open")}</button>;
  return <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate><Field label={t("label")} htmlFor={`message-${slotId}`} hint={t("hint")} error={error ?? undefined}><textarea id={`message-${slotId}`} name="message" required rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClasses} /></Field><div className="flex gap-2"><button type="submit" disabled={pending} className={primaryButton}>{pending ? t("sending") : t("submit")}</button><button type="button" disabled={pending} onClick={() => setOpen(false)} className={secondaryButton}>{t("cancel")}</button></div></form>;
}
