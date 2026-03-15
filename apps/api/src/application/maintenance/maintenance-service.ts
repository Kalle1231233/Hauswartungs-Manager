import type { MaintenancePlanCreateInput } from "@haus/shared";

import { prisma } from "../../infrastructure/database/prisma.js";
import { assertCondition } from "../common/errors.js";
import { assertSameOrganization, type RequestContext } from "../common/tenant.js";

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export async function listMaintenancePlans(context: RequestContext) {
  return prisma.maintenancePlan.findMany({
    where: {
      organizationId: context.effectiveOrganizationId,
      ...(context.role === "TECHNICIAN" || context.role === "SERVICE_PROVIDER"
        ? {
            OR: [
              { responsibleUserId: context.userId },
              { responsibleRole: context.role }
            ]
          }
        : {})
    },
    include: {
      property: true,
      responsibleUser: {
        select: { id: true, name: true, email: true }
      },
      occurrences: {
        orderBy: { dueDate: "desc" },
        include: {
          ticket: {
            select: { id: true, status: true, title: true }
          }
        }
      }
    },
    orderBy: [{ nextDueDate: "asc" }, { createdAt: "desc" }]
  });
}

export async function createMaintenancePlan(
  context: RequestContext,
  input: MaintenancePlanCreateInput
) {
  const [property, responsibleUser] = await Promise.all([
    prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true, organizationId: true }
    }),
    input.responsibleUserId
      ? prisma.user.findUnique({
          where: { id: input.responsibleUserId },
          select: { id: true, organizationId: true, isActive: true }
        })
      : Promise.resolve(null)
  ]);

  assertCondition(property, 404, "Property not found.");
  assertSameOrganization(property.organizationId, context.effectiveOrganizationId);

  if (responsibleUser) {
    assertCondition(responsibleUser.isActive, 400, "Responsible user is inactive.");
    assertSameOrganization(responsibleUser.organizationId ?? "", context.effectiveOrganizationId);
  }

  return prisma.maintenancePlan.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      propertyId: input.propertyId,
      title: input.title,
      category: input.category,
      description: input.description,
      intervalMonths: input.intervalMonths,
      nextDueDate: new Date(input.nextDueDate),
      responsibleUserId: input.responsibleUserId,
      responsibleRole: input.responsibleRole,
      createdById: context.userId
    },
    include: {
      property: true,
      responsibleUser: {
        select: { id: true, name: true, email: true }
      }
    }
  });
}

export async function generateDueMaintenanceOccurrences(context: RequestContext, referenceDate?: string) {
  const reference = referenceDate ? new Date(referenceDate) : new Date();

  const plans = await prisma.maintenancePlan.findMany({
    where: {
      organizationId: context.effectiveOrganizationId,
      isActive: true,
      nextDueDate: {
        lte: reference
      }
    }
  });

  const generated = [];

  for (const plan of plans) {
    const result = await prisma.$transaction(async (transaction) => {
      const existingOccurrence = await transaction.maintenanceOccurrence.findFirst({
        where: {
          maintenancePlanId: plan.id,
          dueDate: plan.nextDueDate
        }
      });

      if (existingOccurrence) {
        return null;
      }

      const ticket = await transaction.ticket.create({
        data: {
          organizationId: plan.organizationId,
          propertyId: plan.propertyId,
          title: plan.title,
          description: plan.description ?? `Recurring maintenance: ${plan.title}`,
          category: "MAINTENANCE",
          priority: "MEDIUM",
          status: plan.responsibleUserId ? "ASSIGNED" : "NEW",
          dueDate: plan.nextDueDate,
          requesterUserId: context.userId,
          responsibleUserId: plan.responsibleUserId
        }
      });

      await transaction.ticketActivity.create({
        data: {
          organizationId: plan.organizationId,
          ticketId: ticket.id,
          actorUserId: context.userId,
          type: "CREATED",
          message: "Created from maintenance plan."
        }
      });

      const occurrence = await transaction.maintenanceOccurrence.create({
        data: {
          organizationId: plan.organizationId,
          maintenancePlanId: plan.id,
          ticketId: ticket.id,
          dueDate: plan.nextDueDate,
          status: "GENERATED"
        }
      });

      await transaction.maintenancePlan.update({
        where: { id: plan.id },
        data: {
          nextDueDate: addMonths(plan.nextDueDate, plan.intervalMonths)
        }
      });

      return occurrence;
    });

    if (result) {
      generated.push(result);
    }
  }

  return {
    generatedCount: generated.length,
    occurrences: generated
  };
}
