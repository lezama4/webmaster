"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputClasses, primaryButton } from "@ui/components/ui";

const DESTINATION_BY_ROLE: Record<string, string> = { admin: "/admin/profiles", hospital: "/hospital/slots", artist: "/artist/slots", patient: "/events" };

export default function LoginPage() {
  const t = useTranslations("Login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setPending(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!res.ok) { setError(t("errors.invalidCredentials")); return; }
      const { role } = (await res.json()) as { role?: string };
      router.push(DESTINATION_BY_ROLE[role ?? ""] ?? "/events"); router.refresh();
    } catch { setError(t("errors.generic")); } finally { setPending(false); }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-2"><h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1><p className="text-muted">{t("description")}</p></div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t("email")} htmlFor="email"><input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} /></Field>
        <Field label={t("password")} htmlFor="password" error={error ?? undefined}><input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClasses} /></Field>
        <button type="submit" disabled={pending} className={`${primaryButton} mt-2`}>{pending ? t("submitting") : t("submit")}</button>
      </form>
      <p className="text-sm text-muted">{t("noAccount")} <Link href="/register" className="font-medium text-foreground underline underline-offset-4">{t("register")}</Link></p>
    </div>
  );
}
