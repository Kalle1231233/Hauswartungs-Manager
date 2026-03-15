import type {
  TicketAssignInput,
  TicketCommentCreateInput,
  TicketCreateInput,
  TicketStatus,
  TicketStatusUpdateInput
} from "@haus/shared";

import { prisma } from "../../infrastructure/database/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError, assertCondition } from "../common/errors.js";
import { assertSameOrganization, type RequestContext } from "../common/tenant.js";
import { canTransitionTicket } from "./ticket-workflow.js";

type TicketListFilters = {
  propertyId?: string;
  status?: TicketStatus;
  responsibleUserId?: string;
  category?: string;
};

async function assertResidentCanCreateTicket(
  context: RequestContext,
  propertyId: string,
  unitId?: string
) {
  if (context.role !== "RESIDENT") {
    return;
  }

  const assignment = await prisma.residentAssignment.findFirst({
    where: {
      organizationId: context.effectiveOrganizationId,
      userId: context.userId,
      propertyId,
      ...(unitId ? { unitId } : {})
    }
  });

  assertCondition(
    assignment,
    403,
    "Residents may only create tickets for assigned properties or units."
  );
}

function buildTicketVisibilityWhere(context: RequestContext): Prisma.TicketWhereInput {
  if (context.role === "RESIDENT") {
    return {
      requesterUserId: context.userId
    };
  }

  if (context.role === "TECHNICIAN" || context.role === "SERVICE_PROVIDER") {
    return {
      responsibleUserId: context.userId
    };
  }

  return {};
}

function assertTicketReadable(
  context: RequestContext,
  ticket: { organizationId: string; requesterUserId: string; responsibleUserId: string | null }
) {
  assertSameOrganization(ticket.organizationId, context.effectiveOrganizationId);

  if (context.role === "RESIDENT" && ticket.requesterUserId !== context.userId) {
    throw new AppError(403, "Residents can only access their own tickets.");
  }

  if (
    (context.role === "TECHNICIAN" || context.role === "SERVICE_PROVIDER") &&
    ticket.responsibleUserId !== context.userId
  ) {
    throw new AppError(403, "You can only access assigned tickets.");
  }
}

async function loadTicketForMutation(context: RequestContext, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      requesterUserId: true,
      responsibleUserId: true,
      propertyId: true
    }
  });

  assertCondition(ticket, 404, "Ticket not found.");
  assertTicketReadable(context, ticket);
  return ticket;
}

export async function listTickets(context: RequestContext, filters: TicketListFilters) {
  return prisma.ticket.findMany({
    where: {
      organizationId: context.effectiveOrganizationId,
      ...buildTicketVisibilityWhere(context),
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.responsibleUserId ? { responsibleUserId: filters.responsibleUserId } : {}),
      ...(filters.category ? { category: filters.category as never } : {})
    },
    include: {
      property: true,
      unit: true,
      requesterUser: {
        select: { id: true, name: true, email: true, role: true }
      },
      responsibleUser: {
        select: { id: true, name: true, email: true, role: true }
      }
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }]
  });
}

export async function getTicketDetail(context: RequestContext, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      property: true,
      unit: true,
      requesterUser: {
        select: { id: true, name: true, email: true, role: true }
      },
      responsibleUser: {
        select: { id: true, name: true, email: true, role: true }
      },
      activities: {
        orderBy: { createdAt: "desc" },
        include: {
          actorUser: {
            select: { id: true, name: true, role: true }
          }
        }
      },
      attachments: {
        orderBy: { createdAt: "desc" }
      },
      checklistInstances: {
        include: {
          template: {
            include: {
              items: {
                orderBy: { sortOrder: "asc" }
              }
            }
          },
          responses: true,
          attachments: true
        },
        orderBy: { createdAt: "desc" }
      },
      timeEntries: {
        include: {
          user: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  assertCondition(ticket, 404, "Ticket not found.");
  assertTicketReadable(context, ticket);
  return ticket;
}

export async function createTicket(context: RequestContext, input: TicketCreateInput) {
  const [property, unit, responsibleUser] = await Promise.all([
    prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true, organizationId: true }
    }),
    input.unitId
      ? prisma.unit.findUnique({
          where: { id: input.unitId },
          select: { id: true, organizationId: true, propertyId: true }
        })
      : Promise.resolve(null),
    input.responsibleUserId
      ? prisma.user.findUnique({
          where: { id: input.responsibleUserId },
          select: { id: true, organizationId: true, role: true, isActive: true }
        })
      : Promise.resolve(null)
  ]);

  assertCondition(property, 404, "Property not found.");
  assertSameOrganization(property.organizationId, context.effectiveOrganizationId);

  if (unit) {
    assertSameOrganization(unit.organizationId, context.effectiveOrganizationId);
    assertCondition(unit.propertyId === property.id, 400, "Unit does not belong to property.");
  }

  if (responsibleUser) {
    assertCondition(responsibleUser.isActive, 400, "Responsible user is inactive.");
    assertSameOrganization(responsibleUser.organizationId ?? "", context.effectiveOrganizationId);
  }

  await assertResidentCanCreateTicket(context, input.propertyId, input.unitId);

  const createdTicket = await prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.create({
      data: {
        organizationId: context.effectiveOrganizationId,
        propertyId: input.propertyId,
        unitId: input.unitId,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        requesterUserId: context.userId,
        responsibleUserId: responsibleUser?.id,
        status: responsibleUser ? "ASSIGNED" : "NEW"
      }
    });

    await transaction.ticketActivity.create({
      data: {
        organizationId: context.effectiveOrganizationId,
        ticketId: ticket.id,
        actorUserId: context.userId,
        type: "CREATED",
        message: ticket.description
      }
    });

    if (responsibleUser) {
      await transaction.ticketActivity.create({
        data: {
          organizationId: context.effectiveOrganizationId,
          ticketId: ticket.id,
          actorUserId: context.userId,
          type: "ASSIGNED",
          message: `Assigned to ${responsibleUser.id}`
        }
      });
    }

    return ticket;
  });

  return getTicketDetail(context, createdTicket.id);
}

export async function assignTicket(
  context: RequestContext,
  ticketId: string,
  input: TicketAssignInput
) {
  const [ticket, user] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        organizationId: true,
        status: true
      }
    }),
    prisma.user.findUnique({
      where: { id: input.responsibleUserId },
      select: {
        id: true,
        organizationId: true,
        isActive: true
      }
    })
  ]);

  assertCondition(ticket, 404, "Ticket not found.");
  assertSameOrganization(ticket.organizationId, context.effectiveOrganizationId);
  assertCondition(user?.isActive, 404, "Responsible user not found or inactive.");
  assertSameOrganization(user.organizationId ?? "", context.effectiveOrganizationId);

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        responsibleUserId: user.id,
        status: ticket.status === "NEW" ? "ASSIGNED" : ticket.status
      }
    }),
    prisma.ticketActivity.create({
      data: {
        organizationId: context.effectiveOrganizationId,
        ticketId,
        actorUserId: context.userId,
        type: "ASSIGNED",
        message: `Assigned to ${user.id}`
      }
    })
  ]);

  return getTicketDetail(context, ticketId);
}

export async function updateTicketStatus(
  context: RequestContext,
  ticketId: string,
  input: TicketStatusUpdateInput
) {
  if (context.role === "RESIDENT") {
    throw new AppError(403, "Residents cannot change ticket statuses.");
  }

  const ticket = await loadTicketForMutation(context, ticketId);

  if (
    (context.role === "TECHNICIAN" || context.role === "SERVICE_PROVIDER") &&
    ticket.responsibleUserId !== context.userId
  ) {
    throw new AppError(403, "Only the assigned user may change the status.");
  }

  assertCondition(
    canTransitionTicket(ticket.status, input.status),
    400,
    `Invalid status transition from ${ticket.status} to ${input.status}.`
  );

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: input.status,
        closedAt: input.status === "CLOSED" ? new Date() : null
      }
    }),
    prisma.ticketActivity.create({
      data: {
        organizationId: context.effectiveOrganizationId,
        ticketId,
        actorUserId: context.userId,
        type: "STATUS_CHANGED",
        message: input.note,
        fromStatus: ticket.status,
        toStatus: input.status
      }
    })
  ]);

  return getTicketDetail(context, ticketId);
}

export async function addTicketComment(
  context: RequestContext,
  ticketId: string,
  input: TicketCommentCreateInput
) {
  const ticket = await loadTicketForMutation(context, ticketId);

  if (
    (context.role === "TECHNICIAN" || context.role === "SERVICE_PROVIDER") &&
    ticket.responsibleUserId !== context.userId
  ) {
    throw new AppError(403, "Only the assigned user may comment.");
  }

  if (context.role === "RESIDENT" && ticket.requesterUserId !== context.userId) {
    throw new AppError(403, "Residents can only comment on their own tickets.");
  }

  await prisma.ticketActivity.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      ticketId,
      actorUserId: context.userId,
      type: "COMMENTED",
      message: input.message
    }
  });

  return getTicketDetail(context, ticketId);
}

export async function addTicketAttachment(
  context: RequestContext,
  ticketId: string,
  file: { fileName: string; filePath: string; mimeType: string }
) {
  const ticket = await loadTicketForMutation(context, ticketId);

  if (
    (context.role === "TECHNICIAN" || context.role === "SERVICE_PROVIDER") &&
    ticket.responsibleUserId !== context.userId
  ) {
    throw new AppError(403, "Only the assigned user may upload attachments.");
  }

  if (context.role === "RESIDENT" && ticket.requesterUserId !== context.userId) {
    throw new AppError(403, "Residents can only upload to their own tickets.");
  }

  await prisma.ticketAttachment.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      ticketId,
      fileName: file.fileName,
      filePath: file.filePath,
      mimeType: file.mimeType,
      uploadedById: context.userId
    }
  });

  return getTicketDetail(context, ticketId);
}
