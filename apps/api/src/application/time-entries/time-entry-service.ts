import type { TimeEntryCreateInput } from "@haus/shared";

import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError, assertCondition } from "../common/errors.js";
import { assertSameOrganization, type RequestContext } from "../common/tenant.js";

function calculateDurationMinutes(input: TimeEntryCreateInput) {
  if (input.durationMinutes) {
    return input.durationMinutes;
  }

  const startedAt = new Date(input.startedAt!);
  const endedAt = new Date(input.endedAt!);
  return Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
}

export async function addTimeEntry(
  context: RequestContext,
  ticketId: string,
  input: TimeEntryCreateInput
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      responsibleUserId: true
    }
  });

  assertCondition(ticket, 404, "Ticket not found.");
  assertSameOrganization(ticket.organizationId, context.effectiveOrganizationId);

  if (
    (context.role === "TECHNICIAN" || context.role === "SERVICE_PROVIDER") &&
    ticket.responsibleUserId !== context.userId
  ) {
    throw new AppError(403, "Only the assigned user may log time.");
  }

  return prisma.timeEntry.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      ticketId,
      propertyId: ticket.propertyId,
      userId: context.userId,
      startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
      endedAt: input.endedAt ? new Date(input.endedAt) : undefined,
      durationMinutes: calculateDurationMinutes(input),
      note: input.note
    },
    include: {
      user: {
        select: { id: true, name: true }
      }
    }
  });
}

export async function getTimeSummary(
  context: RequestContext,
  filters: { propertyId?: string; from?: string; to?: string }
) {
  return prisma.timeEntry.groupBy({
    by: ["propertyId"],
    where: {
      organizationId: context.effectiveOrganizationId,
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {})
            }
          }
        : {})
    },
    _sum: {
      durationMinutes: true
    },
    orderBy: {
      propertyId: "asc"
    }
  });
}
