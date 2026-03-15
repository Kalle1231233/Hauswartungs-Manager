import type { Role } from "@haus/shared";

import { AppError, assertCondition } from "./errors.js";

export type RequestContext = {
  userId: string;
  organizationId: string | null;
  effectiveOrganizationId: string;
  role: Role;
  email: string;
  name: string;
};

export function resolveEffectiveOrganizationId(
  role: Role,
  organizationId: string | null,
  requestedOrganizationId?: string
) {
  if (role === "SUPER_ADMIN") {
    assertCondition(requestedOrganizationId, 400, "Super admin must provide x-organization-id.");
    return requestedOrganizationId;
  }

  assertCondition(organizationId, 403, "No organization assigned to user.");
  return organizationId;
}

export function assertSameOrganization(entityOrganizationId: string, effectiveOrganizationId: string) {
  if (entityOrganizationId !== effectiveOrganizationId) {
    throw new AppError(404, "Entity not found in current organization scope.");
  }
}
