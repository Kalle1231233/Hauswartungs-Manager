import type { NextFunction, Request, Response } from "express";

import type { Role } from "@haus/shared";

import { AppError } from "../../../application/common/errors.js";

export function authorize(...roles: Role[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const role = request.auth?.role;

    if (!role) {
      next(new AppError(401, "Authentication required."));
      return;
    }

    if (!roles.includes(role)) {
      next(new AppError(403, "Insufficient permissions."));
      return;
    }

    next();
  };
}
