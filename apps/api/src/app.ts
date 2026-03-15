import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";

import { env } from "./config/env.js";
import { AppError } from "./application/common/errors.js";
import { ensureUploadRoot, getUploadRoot } from "./infrastructure/files/storage.js";
import { authRouter } from "./interfaces/http/routes/auth-routes.js";
import { checklistRouter } from "./interfaces/http/routes/checklist-routes.js";
import { maintenanceRouter } from "./interfaces/http/routes/maintenance-routes.js";
import { overviewRouter } from "./interfaces/http/routes/overview-routes.js";
import { propertyRouter } from "./interfaces/http/routes/property-routes.js";
import { ticketRouter } from "./interfaces/http/routes/ticket-routes.js";

export async function createApp() {
  await ensureUploadRoot();

  const app = express();
  const staticRoot = getUploadRoot();
  const projectRoot = fileURLToPath(new URL("..", import.meta.url));

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true
    })
  );
  app.use(helmet());
  app.use(morgan("dev"));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use("/uploads", express.static(staticRoot));

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/properties", propertyRouter);
  app.use("/api/tickets", ticketRouter);
  app.use("/api/maintenance-plans", maintenanceRouter);
  app.use("/api/checklists", checklistRouter);
  app.use("/api/overview", overviewRouter);

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        message: "Validation error.",
        issues: error.issues
      });
      return;
    }

    if (error instanceof AppError) {
      response.status(error.statusCode).json({
        message: error.message,
        details: error.details
      });
      return;
    }

    console.error(error);
    response.status(500).json({
      message: "Internal server error."
    });
  });

  if (env.nodeEnv !== "production") {
    app.get("/", (_request, response) => {
      response.sendFile(path.join(projectRoot, "../web/index.html"));
    });
  }

  return app;
}
