import type { Request } from "express";

import { AppError } from "../../../application/common/errors.js";
import {
  resolveEffectiveOrganizationId,
  type RequestContext
} from "../../../application/common/tenant.js";

export function getRequestContext(request: Request): RequestContext {
  if (!request.auth) {
    throw new AppError(401, "Authentication required.");
  }

  const requestedOrganizationId = request.header("x-organization-id") ?? undefined;

  return {
    userId: request.auth.userId,
    organizationId: request.auth.organizationId,
    effectiveOrganizationId: resolveEffectiveOrganizationId(
      request.auth.role,
      request.auth.organizationId,
      requestedOrganizationId
    ),
    role: request.auth.role,
    email: request.auth.email,
    name: request.auth.name
  };
}
