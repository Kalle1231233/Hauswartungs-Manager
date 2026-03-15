import { Router } from "express";
import { z } from "zod";

import {
  propertyContactCreateSchema,
  propertyCreateSchema,
  unitCreateSchema
} from "@haus/shared";

import {
  addPropertyDocument,
  assignResidentToUnit,
  createProperty,
  createPropertyContact,
  createUnit,
  getProperty,
  listProperties
} from "../../../application/properties/property-service.js";
import { AppError } from "../../../application/common/errors.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { asyncHandler } from "../utils/async-handler.js";
import { getRequestContext } from "../utils/request-context.js";
import { upload } from "../utils/upload.js";

export const propertyRouter = Router();

const propertyIdParamSchema = z.object({
  propertyId: z.string().cuid()
});

const propertyResidentAssignmentSchema = z.object({
  userId: z.string().cuid(),
  unitId: z.string().cuid().optional()
});

propertyRouter.use(authenticate);

propertyRouter.get(
  "/",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER", "RESIDENT"),
  asyncHandler(async (request, response) => {
    const properties = await listProperties(getRequestContext(request));
    response.json(properties);
  })
);

propertyRouter.post(
  "/",
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const input = propertyCreateSchema.parse(request.body);
    const property = await createProperty(getRequestContext(request), input);
    response.status(201).json(property);
  })
);

propertyRouter.get(
  "/:propertyId",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER", "RESIDENT"),
  asyncHandler(async (request, response) => {
    const { propertyId } = propertyIdParamSchema.parse(request.params);
    const property = await getProperty(getRequestContext(request), propertyId);
    response.json(property);
  })
);

propertyRouter.post(
  "/:propertyId/units",
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const input = unitCreateSchema.parse(request.body);
    const { propertyId } = propertyIdParamSchema.parse(request.params);
    const unit = await createUnit(getRequestContext(request), propertyId, input);
    response.status(201).json(unit);
  })
);

propertyRouter.post(
  "/:propertyId/contacts",
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const input = propertyContactCreateSchema.parse(request.body);
    const { propertyId } = propertyIdParamSchema.parse(request.params);
    const contact = await createPropertyContact(
      getRequestContext(request),
      propertyId,
      input
    );
    response.status(201).json(contact);
  })
);

propertyRouter.post(
  "/:propertyId/documents",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN"),
  upload.single("file"),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new AppError(400, "File upload is required.");
    }

    const { persistUploadedFile } = await import("../../../infrastructure/files/storage.js");
    const { propertyId } = propertyIdParamSchema.parse(request.params);
    const storedFile = await persistUploadedFile(request.file, "property-documents");
    const document = await addPropertyDocument(getRequestContext(request), propertyId, storedFile);
    response.status(201).json(document);
  })
);

propertyRouter.post(
  "/:propertyId/resident-assignments",
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const { propertyId } = propertyIdParamSchema.parse(request.params);
    const payload = propertyResidentAssignmentSchema.parse(request.body);

    const assignment = await assignResidentToUnit(
      getRequestContext(request),
      payload.userId,
      propertyId,
      payload.unitId
    );

    response.status(201).json(assignment);
  })
);
