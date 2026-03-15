import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../../application/common/errors.js";
import { verifyAccessToken } from "../../../infrastructure/security/tokens.js";

export function authenticate(request: Request, _response: Response, next: NextFunction) {
  const header = request.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    next(new AppError(401, "Missing bearer token."));
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    request.auth = {
      userId: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
      email: payload.email,
      name: payload.name
    };
    next();
  } catch {
    next(new AppError(401, "Invalid or expired access token."));
  }
}
