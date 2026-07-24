"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Field, inputClasses, primaryButton, secondaryButton } from "@ui/components/ui";

type Action = "approve" | "reject" | "deactivate";
type ProfileType = "centre" | "artist";

const ACTION_LABEL_KEYS: Record<Action, { readonly idle: string; readonly pending: string }> = {
  approve: { idle: "approve", pending: "approving" },
  reject: { idle: "reject", pending: "rejecting" },
  deactivate: { idle: "deactivate", pending: "deactivating" },
};

/**
 * Admin decision controls for one Profile row (auditable-profile-approval,
 * PR4/D24/D27). Every action here (`approve`/`reject`/`deactivate`) requires
 * a non-blank basis before it can be submitted — a UI-level convenience gate
 * only; the AUTHORITATIVE non-blank/bounded check lives in the domain
 * (`Profile.ts`'s `assertValidBasis`), so a scripted request that skips this
 * component entirely is still denied (D24).
 *
 * The basis textarea's placeholder is role-cued (D27): a `centre` cues
 * institutional/convenio verification, an `artist` cues identity +
 * safeguarding verification. This is UI/i18n copy only — the domain accepts
 * any valid basis string regardless of role.
 */
export function ProfileRowActions({
  profileId,
  profileType,
  actions,
}: {
  profileId: string;
  profileType: ProfileType;
  actions: readonly Action[];
}) {
  const t = useTranslations("ProfileActions");
  const router = useRouter();
  const [basis, setBasis] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = basis.trim().length > 0;
  const basisFieldId = `profile-basis-${profileId}`;

  async function run(action: Action) {
    if (!canSubmit) return;
    setError(null);
    setPending(action);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basis }),
      });
      if (!res.ok) {
        setError(t("error"));
        return;
      }
      router.refresh();
    } catch {
      setError(t("genericError"));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex w-full flex-col items-start gap-3 sm:items-end">
      <div className="w-full sm:max-w-xs">
        <Field label={t("basis.label")} htmlFor={basisFieldId}>
          <textarea
            id={basisFieldId}
            name="basis"
            required
            rows={2}
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            placeholder={t(`basis.placeholder.${profileType}`)}
            className={inputClasses}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={pending !== null || !canSubmit}
            onClick={() => run(action)}
            className={action === "approve" ? primaryButton : secondaryButton}
          >
            {pending === action ? t(ACTION_LABEL_KEYS[action].pending) : t(ACTION_LABEL_KEYS[action].idle)}
          </button>
        ))}
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
