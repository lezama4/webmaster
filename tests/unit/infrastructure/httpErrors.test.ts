import { describe, expect, it } from "vitest";

import { PasswordPolicyError } from "@domain/account/Password";
import { DomainValidationError } from "@domain/errors";
import { toErrorResponse } from "@infrastructure/http/httpErrors";

describe("toErrorResponse — password policy", () => {
  it.each(["too_short", "too_long"] as const)("exposes a localizable code for %s", async (reason) => {
    const res = toErrorResponse(new PasswordPolicyError(reason));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Invalid request", code: `password_${reason}` });
  });

  it("keeps other domain errors generic, with no code", async () => {
    const res = toErrorResponse(new DomainValidationError("secret detail"));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });
});
