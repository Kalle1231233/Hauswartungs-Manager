import { Router } from "express";

import {
  checklistSubmitSchema,
  checklistTemplateCreateSchema
} from "@haus/shared";

import {
  createChecklistTemplate,
  listChecklistTemplates,
  submitChecklistInstance
} from "../../../application/checklists/checklist-service.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { asyncHandler } from "../utils/async-handler.js";
import { getRequestContext } from "../utils/request-context.js";

export const checklistRouter = Router();

checklistRouter.use(authenticate);

checklistRouter.get(
  "/templates",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER"),
  asyncHandler(async (request, response) => {
    const templates = await listChecklistTemplates(getRequestContext(request));
    response.json(templates);
  })
);

checklistRouter.post(
  "/templates",
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const input = checklistTemplateCreateSchema.parse(request.body);
    const template = await createChecklistTemplate(getRequestContext(request), input);
    response.status(201).json(template);
  })
);

checklistRouter.post(
  "/instances/:checklistInstanceId/submit",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER"),
  asyncHandler(async (request, response) => {
    const input = checklistSubmitSchema.parse(request.body);
    const instance = await submitChecklistInstance(
      getRequestContext(request),
      request.params.checklistInstanceId,
      input
    );
    response.json(instance);
  })
);
