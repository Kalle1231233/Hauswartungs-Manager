import crypto from "node:crypto";

import jwt from "jsonwebtoken";

import type { Role } from "@haus/shared";

import { env } from "../../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  organizationId: string | null;
  role: Role;
  email: string;
  name: string;
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export function createOpaqueToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function hashOpaqueToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
