"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Field, inputClasses, primaryButton } from "@ui/components/ui";

type Role = "hospital" | "artist";

export default function RegisterPage() {
  const t = useTranslations("Register");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("hospital"); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false); const [done, setDone] = useState(false);
  // Optional PUBLIC hospital location (Phase 2) — hospital-only, never shown/sent for artists.
  const [city, setCity] = useState(""); const [postalCode, setPostalCode] = useState(""); const [addressLine, setAddressLine] = useState("");
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setPending(true);
    try {
      const body: Record<string, unknown> = { name, email, password, role };
      if (role === "hospital") {
        if (city.trim()) body.city = city.trim();
        if (postalCode.trim()) body.postalCode = postalCode.trim();
        if (addressLine.trim()) body.addressLine = addressLine.trim();
      }
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { setError(res.status === 409 ? t("errors.duplicateEmail") : t("errors.failure")); return; }
      setDone(true);
    } catch { setError(t("errors.generic")); } finally { setPending(false); }
  }
  if (done) return <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16 sm:px-6"><h1 className="font-heading text-2xl font-semibold tracking-tight">{t("success.title")}</h1><p className="text-muted">{t("success.description")}</p><Link href="/login" className={`${primaryButton} mt-2 self-start`}>{t("success.action")}</Link></div>;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-2"><h1 className="font-heading text-2xl font-semibold tracking-tight">{t("title")}</h1><p className="text-muted">{t("description")}</p></div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t("role.label")} htmlFor="role"><select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClasses}><option value="hospital">{t("role.hospital")}</option><option value="artist">{t("role.artist")}</option></select></Field>
        <Field label={role === "hospital" ? t("name.hospital") : t("name.artist")} htmlFor="name"><input id="name" name="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} /></Field>
        {role === "hospital" ? (
          <>
            <Field label={t("location.city")} htmlFor="city" hint={t("location.hint")}><input id="city" name="city" type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClasses} /></Field>
            <Field label={t("location.postalCode")} htmlFor="postalCode"><input id="postalCode" name="postalCode" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClasses} /></Field>
            <Field label={t("location.addressLine")} htmlFor="addressLine"><input id="addressLine" name="addressLine" type="text" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} className={inputClasses} /></Field>
          </>
        ) : null}
        <Field label={t("email")} htmlFor="email"><input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} /></Field>
        <Field label={t("password")} htmlFor="password" hint={t("passwordHint")} error={error ?? undefined}><input id="password" name="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClasses} /></Field>
        <button type="submit" disabled={pending} className={`${primaryButton} mt-2`}>{pending ? t("submitting") : t("submit")}</button>
      </form>
      <p className="text-sm text-muted">{t("alreadyRegistered")} <Link href="/login" className="font-medium text-foreground underline underline-offset-4">{t("login")}</Link></p>
    </div>
  );
}
