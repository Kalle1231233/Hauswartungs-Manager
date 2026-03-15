import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../../infrastructure/database/prisma.js";
import { getTimeSummary } from "../../../application/time-entries/time-entry-service.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { asyncHandler } from "../utils/async-handler.js";
import { getRequestContext } from "../utils/request-context.js";

const adminQuerySchema = z.object({
  propertyId: z.string().cuid().optional(),
  status: z.string().optional(),
  category: z.string().optional()
});

export const overviewRouter = Router();

overviewRouter.use(authenticate);

overviewRouter.get(
  "/technician",
  authorize("TECHNICIAN", "SERVICE_PROVIDER", "ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const context = getRequestContext(request);

    const [tickets, maintenanceOccurrences] = await Promise.all([
      prisma.ticket.findMany({
        where: {
          organizationId: context.effectiveOrganizationId,
          responsibleUserId: context.userId,
          status: {
            notIn: ["DONE", "CLOSED"]
          }
        },
        include: {
          property: true
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }]
      }),
      prisma.maintenanceOccurrence.findMany({
        where: {
          organizationId: context.effectiveOrganizationId,
          status: {
            in: ["PLANNED", "GENERATED"]
          },
          maintenancePlan: {
            OR: [{ responsibleUserId: context.userId }, { responsibleRole: context.role }]
          }
        },
        include: {
          maintenancePlan: {
            include: {
              property: true
            }
          },
          ticket: true
        },
        orderBy: { dueDate: "asc" }
      })
    ]);

    response.json({
      tickets,
      maintenanceOccurrences
    });
  })
);

overviewRouter.get(
  "/admin",
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const context = getRequestContext(request);
    const filters = adminQuerySchema.parse(request.query);

    const [tickets, maintenancePlans, timeSummary] = await Promise.all([
      prisma.ticket.findMany({
        where: {
          organizationId: context.effectiveOrganizationId,
          ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
          ...(filters.status ? { status: filters.status as never } : {}),
          ...(filters.category ? { category: filters.category as never } : {})
        },
        include: {
          property: true,
          responsibleUser: {
            select: { id: true, name: true }
          }
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }]
      }),
      prisma.maintenancePlan.findMany({
        where: {
          organizationId: context.effectiveOrganizationId,
          ...(filters.propertyId ? { propertyId: filters.propertyId } : {})
        },
        include: {
          property: true,
          occurrences: {
            orderBy: { dueDate: "desc" },
            take: 5
          }
        },
        orderBy: { nextDueDate: "asc" }
      }),
      getTimeSummary(context, {
        propertyId: filters.propertyId
      })
    ]);

    response.json({
      tickets,
      maintenancePlans,
      timeSummary
    });
  })
);
