import { Router } from "express";
import { z } from "zod";

import { maintenancePlanCreateSchema } from "@haus/shared";

import {
  createMaintenancePlan,
  generateDueMaintenanceOccurrences,
  listMaintenancePlans
} from "../../../application/maintenance/maintenance-service.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { asyncHandler } from "../utils/async-handler.js";
import { getRequestContext } from "../utils/request-context.js";

const generateSchema = z.object({
  referenceDate: z.string().datetime().optional()
});

export const maintenanceRouter = Router();

maintenanceRouter.use(authenticate);

maintenanceRouter.get(
  "/",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER"),
  asyncHandler(async (request, response) => {
    const plans = await listMaintenancePlans(getRequestContext(request));
    response.json(plans);
  })
);

maintenanceRouter.post(
  "/",
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const input = maintenancePlanCreateSchema.parse(request.body);
    const plan = await createMaintenancePlan(getRequestContext(request), input);
    response.status(201).json(plan);
  })
);

maintenanceRouter.post(
  "/generate-due",
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const input = generateSchema.parse(request.body ?? {});
    const result = await generateDueMaintenanceOccurrences(
      getRequestContext(request),
      input.referenceDate
    );
    response.json(result);
  })
);
