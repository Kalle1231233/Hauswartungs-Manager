import { describe, expect, it } from "vitest";

import { AppError } from "./errors.js";
import {
  assertSameOrganization,
  resolveEffectiveOrganizationId
} from "./tenant.js";

describe("tenant helpers", () => {
  it("uses the user organization for tenant-scoped users", () => {
    expect(resolveEffectiveOrganizationId("ORG_ADMIN", "org-1")).toBe("org-1");
  });

  it("requires an explicit organization for super admins", () => {
    expect(() => resolveEffectiveOrganizationId("SUPER_ADMIN", null)).toThrow(AppError);
    expect(resolveEffectiveOrganizationId("SUPER_ADMIN", null, "org-2")).toBe("org-2");
  });

  it("throws when entities are accessed across tenant boundaries", () => {
    expect(() => assertSameOrganization("org-1", "org-2")).toThrow(AppError);
  });
});
