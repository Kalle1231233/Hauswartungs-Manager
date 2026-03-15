import type { Role } from "@haus/shared";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        organizationId: string | null;
        role: Role;
        email: string;
        name: string;
      };
    }
  }
}

export {};
