"use client";

import { useState } from "react";
import Link from "next/link";
import { Field, inputClasses, primaryButton } from "@ui/components/ui";

type Role = "hospital" | "artist";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("hospital");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      if (!res.ok) {
        setError(
          res.status === 409
            ? "An account with that email already exists."
            : "Registration could not be completed. Check your details and try again.",
        );
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Request received</h1>
        <p className="text-muted">
          Your profile is pending review by a coordinator. You can log in once
          it has been approved.
        </p>
        <Link href="/login" className={`${primaryButton} mt-2 self-start`}>
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Register</h1>
        <p className="text-muted">
          Hospitals and artists join here. Every profile is reviewed before it
          can act.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="I am registering a" htmlFor="role">
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={inputClasses}
          >
            <option value="hospital">Hospital</option>
            <option value="artist">Artist</option>
          </select>
        </Field>
        <Field
          label={role === "hospital" ? "Hospital name" : "Artist / stage name"}
          htmlFor="name"
        >
          <input
            id="name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClasses}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint="At least 8 characters."
          error={error ?? undefined}
        >
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClasses}
          />
        </Field>
        <button type="submit" disabled={pending} className={`${primaryButton} mt-2`}>
          {pending ? "Submitting…" : "Create profile"}
        </button>
      </form>

      <p className="text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
