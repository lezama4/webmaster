import { registerProfile } from "@application/use-cases/registerProfile";
import type { AccountRole } from "@domain/account/Account";
import { assertValidCentreType, type CentreType } from "@domain/profile/Profile";
import { registrationDeps } from "@infrastructure/composition/container";
import { assertCsrfSafe } from "@infrastructure/http/csrfGuard";
import { toErrorResponse } from "@infrastructure/http/httpErrors";

interface RegisterRequestBody {
  readonly email?: unknown;
  readonly password?: unknown;
  readonly role?: unknown;
  readonly name?: unknown;
  // Required when role === "centre" (D18) — one of the six CentreType
  // values; registerProfile/the domain layer reject it for any other role.
  readonly centreType?: unknown;
  // Optional PUBLIC centre location (Phase 2) — only meaningful when
  // role === "centre"; registerProfile ignores them for any other role.
  readonly city?: unknown;
  readonly postalCode?: unknown;
  readonly addressLine?: unknown;
  readonly latitude?: unknown;
  readonly longitude?: unknown;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Coerces an optional string field, dropping it entirely when absent/empty so it never overrides an unset value with `""`. */
function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Coerces an optional numeric field (e.g. from JSON or a numeric string); `undefined` when absent or not a finite number. */
function optionalNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * D18: coerces the optional `centreType` field, rejecting a malformed value
 * (not one of the six known kinds) BEFORE it ever reaches `registerProfile`.
 * Reuses the domain's own `assertValidCentreType` rather than duplicating
 * the six-value list here. Whether `centreType` is REQUIRED for a given
 * role is deliberately NOT checked at this boundary — that is
 * `registerProfile`/`createProfile`'s domain invariant to enforce (D18: "the
 * use case does not trust the form"), so this stays a pure format guard.
 */
function optionalCentreType(value: unknown): CentreType | undefined {
  const centreType = optionalString(value);
  if (centreType === undefined) return undefined;
  assertValidCentreType(centreType);
  return centreType;
}

/**
 * `POST /api/auth/register` — Centre/Artist self-registration (task 5.1).
 * CSRF-guard → parse → `registerProfile` → response; all error mapping via
 * `toErrorResponse`. Thin by design: every validation/authorization rule
 * lives in `registerProfile`/the domain layer, not here.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertCsrfSafe(request);

    const body = (await request.json()) as RegisterRequestBody;
    const centreType = optionalCentreType(body.centreType);
    const city = optionalString(body.city);
    const postalCode = optionalString(body.postalCode);
    const addressLine = optionalString(body.addressLine);
    const latitude = optionalNumber(body.latitude);
    const longitude = optionalNumber(body.longitude);
    const profile = await registerProfile(
      {
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        role: body.role as AccountRole,
        name: String(body.name ?? ""),
        ...(centreType !== undefined ? { centreType } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(postalCode !== undefined ? { postalCode } : {}),
        ...(addressLine !== undefined ? { addressLine } : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
      },
      registrationDeps(),
    );

    // Generic success body — no Account/Profile id, no credential echo.
    return json(201, { status: profile.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
