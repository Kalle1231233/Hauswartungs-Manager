import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), "apps/api/.env") });
loadEnv();

function getNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: getNumber(process.env.PORT, 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/hauswartungs_manager?schema=public",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "change-me-access",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  refreshTokenTtlDays: getNumber(process.env.REFRESH_TOKEN_TTL_DAYS, 14),
  passwordResetTtlMinutes: getNumber(process.env.PASSWORD_RESET_TTL_MINUTES, 30),
  invitationTtlDays: getNumber(process.env.INVITATION_TTL_DAYS, 7),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173"
};
