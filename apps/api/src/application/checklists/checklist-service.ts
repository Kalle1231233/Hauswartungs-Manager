import type {
  ChecklistSubmitInput,
  ChecklistTemplateCreateInput
} from "@haus/shared";

import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError, assertCondition } from "../common/errors.js";
import { assertSameOrganization, type RequestContext } from "../common/tenant.js";

export async function listChecklistTemplates(context: RequestContext) {
  return prisma.checklistTemplate.findMany({
    where: {
      OR: [
        { organizationId: null },
        { organizationId: context.effectiveOrganizationId }
      ]
    },
    include: {
      items: {
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: { name: "asc" }
  });
}

export async function createChecklistTemplate(
  context: RequestContext,
  input: ChecklistTemplateCreateInput
) {
  return prisma.checklistTemplate.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      name: input.name,
      categoryLabel: input.category,
      items: {
        create: input.items.map((item, index) => ({
          label: item.label,
          required: item.required,
          sortOrder: index + 1
        }))
      }
    },
    include: {
      items: {
        orderBy: { sortOrder: "asc" }
      }
    }
  });
}

export async function createChecklistInstance(
  context: RequestContext,
  ticketId: string,
  templateId: string
) {
  const [ticket, template] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        organizationId: true,
        propertyId: true
      }
    }),
    prisma.checklistTemplate.findUnique({
      where: { id: templateId },
      include: {
        items: {
          orderBy: { sortOrder: "asc" }
        }
      }
    })
  ]);

  assertCondition(ticket, 404, "Ticket not found.");
  assertSameOrganization(ticket.organizationId, context.effectiveOrganizationId);
  assertCondition(template, 404, "Checklist template not found.");

  if (template.organizationId) {
    assertSameOrganization(template.organizationId, context.effectiveOrganizationId);
  }

  return prisma.checklistInstance.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      templateId: template.id,
      ticketId,
      propertyId: ticket.propertyId
    },
    include: {
      template: {
        include: {
          items: {
            orderBy: { sortOrder: "asc" }
          }
        }
      },
      responses: true
    }
  });
}

export async function submitChecklistInstance(
  context: RequestContext,
  checklistInstanceId: string,
  input: ChecklistSubmitInput
) {
  const checklistInstance = await prisma.checklistInstance.findUnique({
    where: { id: checklistInstanceId },
    include: {
      template: {
        include: {
          items: true
        }
      },
      ticket: {
        select: {
          id: true,
          responsibleUserId: true
        }
      }
    }
  });

  assertCondition(checklistInstance, 404, "Checklist instance not found.");
  assertSameOrganization(
    checklistInstance.organizationId,
    context.effectiveOrganizationId
  );

  if (checklistInstance.status === "COMPLETED") {
    throw new AppError(400, "Checklist instance already completed.");
  }

  if (
    (context.role === "TECHNICIAN" || context.role === "SERVICE_PROVIDER") &&
    checklistInstance.ticket.responsibleUserId !== context.userId
  ) {
    throw new AppError(403, "Only the assigned technician may submit this checklist.");
  }

  const requiredIds = new Set(
    checklistInstance.template.items.filter((item) => item.required).map((item) => item.id)
  );

  for (const response of input.responses) {
    requiredIds.delete(response.templateItemId);
  }

  assertCondition(requiredIds.size === 0, 400, "All required checklist items must be answered.");

  await prisma.$transaction(async (transaction) => {
    for (const response of input.responses) {
      await transaction.checklistResponse.upsert({
        where: {
          instanceId_templateItemId: {
            instanceId: checklistInstance.id,
            templateItemId: response.templateItemId
          }
        },
        update: {
          checked: response.checked,
          comment: response.comment
        },
        create: {
          instanceId: checklistInstance.id,
          templateItemId: response.templateItemId,
          checked: response.checked,
          comment: response.comment
        }
      });
    }

    await transaction.checklistInstance.update({
      where: { id: checklistInstance.id },
      data: {
        status: "COMPLETED",
        summary: input.summary,
        completedById: context.userId,
        completedAt: new Date()
      }
    });

    await transaction.ticketActivity.create({
      data: {
        organizationId: checklistInstance.organizationId,
        ticketId: checklistInstance.ticket.id,
        actorUserId: context.userId,
        type: "CHECKLIST_COMPLETED",
        message: checklistInstance.template.name
      }
    });
  });

  return prisma.checklistInstance.findUnique({
    where: { id: checklistInstance.id },
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
    }
  });
}
