import { Router } from "express";
import { z } from "zod";

import {
  checklistInstanceCreateSchema,
  ticketAssignSchema,
  ticketCommentCreateSchema,
  ticketCreateSchema,
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
  status: z.string().optional(),
  responsibleUserId: z.string().cuid().optional(),
  category: z.string().optional()
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
    const ticket = await getTicketDetail(getRequestContext(request), request.params.ticketId);
    response.json(ticket);
  })
);

ticketRouter.post(
  "/:ticketId/assign",
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const input = ticketAssignSchema.parse(request.body);
    const ticket = await assignTicket(getRequestContext(request), request.params.ticketId, input);
    response.json(ticket);
  })
);

ticketRouter.post(
  "/:ticketId/status",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER"),
  asyncHandler(async (request, response) => {
    const input = ticketStatusUpdateSchema.parse(request.body);
    const ticket = await updateTicketStatus(
      getRequestContext(request),
      request.params.ticketId,
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
    const ticket = await addTicketComment(
      getRequestContext(request),
      request.params.ticketId,
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
    const storedFile = await persistUploadedFile(request.file, "ticket-attachments");
    const ticket = await addTicketAttachment(
      getRequestContext(request),
      request.params.ticketId,
      storedFile
    );
    response.json(ticket);
  })
);

ticketRouter.post(
  "/:ticketId/checklists",
  authorize("ORG_ADMIN", "SUPER_ADMIN", "TECHNICIAN", "SERVICE_PROVIDER"),
  asyncHandler(async (request, response) => {
    const input = checklistInstanceCreateSchema.parse({
      ...request.body,
      ticketId: request.params.ticketId
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
    const entry = await addTimeEntry(getRequestContext(request), request.params.ticketId, input);
    response.status(201).json(entry);
  })
);
