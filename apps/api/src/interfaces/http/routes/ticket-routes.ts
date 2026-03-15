import { Router } from "express";
import { z } from "zod";

import {
  checklistInstanceCreateSchema,
  ticketCategorySchema,
  ticketAssignSchema,
  ticketCommentCreateSchema,
  ticketCreateSchema,
  ticketStatusSchema,
  ticketStatusUpdateSchema,
  timeEntryCreateSchema
} from "@haus/shared";

import { createChecklistInstance } from "../../../application/checklists/checklist-service.js";
import { addTimeEntry } from "../../../application/time-entries/time-entry-service.js";
import {
  addTicketAttachment,
  addTicketComment,
  assignTicket,
  createTicket,
  getTicketDetail,
  listTickets,
  updateTicketStatus
} from "../../../application/tickets/ticket-service.js";
import { AppError } from "../../../application/common/errors.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { asyncHandler } from "../utils/async-handler.js";
import { getRequestContext } from "../utils/request-context.js";
import { upload } from "../utils/upload.js";

const listQuerySchema = z.object({
  propertyId: z.string().cuid().optional(),
  status: ticketStatusSchema.optional(),
  responsibleUserId: z.string().cuid().optional(),
  category: ticketCategorySchema.optional()
});

const ticketIdParamSchema = z.object({
  ticketId: z.string().cuid()
});

export const ticketRouter = Router();

ticketRouter.use(authenticate);

ticketRouter.get(
  "/",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER", "RESIDENT"),
  asyncHandler(async (request, response) => {
    const filters = listQuerySchema.parse(request.query);
    const tickets = await listTickets(getRequestContext(request), filters);
    response.json(tickets);
  })
);

ticketRouter.post(
  "/",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "RESIDENT"),
  asyncHandler(async (request, response) => {
    const input = ticketCreateSchema.parse(request.body);
    const ticket = await createTicket(getRequestContext(request), input);
    response.status(201).json(ticket);
  })
);

ticketRouter.get(
  "/:ticketId",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER", "RESIDENT"),
  asyncHandler(async (request, response) => {
    const { ticketId } = ticketIdParamSchema.parse(request.params);
    const ticket = await getTicketDetail(getRequestContext(request), ticketId);
    response.json(ticket);
  })
);

ticketRouter.post(
  "/:ticketId/assign",
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const input = ticketAssignSchema.parse(request.body);
    const { ticketId } = ticketIdParamSchema.parse(request.params);
    const ticket = await assignTicket(getRequestContext(request), ticketId, input);
    response.json(ticket);
  })
);

ticketRouter.post(
  "/:ticketId/status",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER"),
  asyncHandler(async (request, response) => {
    const input = ticketStatusUpdateSchema.parse(request.body);
    const { ticketId } = ticketIdParamSchema.parse(request.params);
    const ticket = await updateTicketStatus(
      getRequestContext(request),
      ticketId,
      input
    );
    response.json(ticket);
  })
);

ticketRouter.post(
  "/:ticketId/comments",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER", "RESIDENT"),
  asyncHandler(async (request, response) => {
    const input = ticketCommentCreateSchema.parse(request.body);
    const { ticketId } = ticketIdParamSchema.parse(request.params);
    const ticket = await addTicketComment(
      getRequestContext(request),
      ticketId,
      input
    );
    response.json(ticket);
  })
);

ticketRouter.post(
  "/:ticketId/attachments",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER", "RESIDENT"),
  upload.single("file"),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new AppError(400, "File upload is required.");
    }

    const { persistUploadedFile } = await import("../../../infrastructure/files/storage.js");
    const { ticketId } = ticketIdParamSchema.parse(request.params);
    const storedFile = await persistUploadedFile(request.file, "ticket-attachments");
    const ticket = await addTicketAttachment(getRequestContext(request), ticketId, storedFile);
    response.json(ticket);
  })
);

ticketRouter.post(
  "/:ticketId/checklists",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER"),
  asyncHandler(async (request, response) => {
    const { ticketId } = ticketIdParamSchema.parse(request.params);
    const input = checklistInstanceCreateSchema.parse({
      ...request.body,
      ticketId
    });
    const instance = await createChecklistInstance(
      getRequestContext(request),
      input.ticketId,
      input.templateId
    );
    response.status(201).json(instance);
  })
);

ticketRouter.post(
  "/:ticketId/time-entries",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER"),
  asyncHandler(async (request, response) => {
    const input = timeEntryCreateSchema.parse(request.body);
    const { ticketId } = ticketIdParamSchema.parse(request.params);
    const entry = await addTimeEntry(getRequestContext(request), ticketId, input);
    response.status(201).json(entry);
  })
);
