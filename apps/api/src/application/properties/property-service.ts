import type {
  PropertyContactCreateInput,
  PropertyCreateInput,
  UnitCreateInput
} from "@haus/shared";
import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError, assertCondition } from "../common/errors.js";
import { assertSameOrganization, type RequestContext } from "../common/tenant.js";

function buildPropertyVisibilityWhere(context: RequestContext): Prisma.PropertyWhereInput {
  if (context.role === "RESIDENT") {
    return {
      residentAssignments: {
        some: {
          userId: context.userId
        }
      }
    };
  }

  if (context.role === "TECHNICIAN" || context.role === "SERVICE_PROVIDER") {
    return {
      OR: [
        {
          tickets: {
            some: {
              responsibleUserId: context.userId
            }
          }
        },
        {
          maintenancePlans: {
            some: {
              OR: [
                { responsibleUserId: context.userId },
                { responsibleRole: context.role }
              ]
            }
          }
        }
      ]
    };
  }

  return {};
}

function buildPropertyInclude(context: RequestContext) {
  if (context.role === "RESIDENT") {
    return {
      units: {
        where: {
          residentAssignments: {
            some: {
              userId: context.userId
            }
          }
        }
      },
      contacts: false,
      documents: false
    } satisfies Prisma.PropertyInclude;
  }

  return {
    units: true,
    contacts: true,
    documents: true
  } satisfies Prisma.PropertyInclude;
}

export async function listProperties(context: RequestContext) {
  return prisma.property.findMany({
    where: {
      organizationId: context.effectiveOrganizationId,
      ...buildPropertyVisibilityWhere(context)
    },
    include: buildPropertyInclude(context),
    orderBy: {
      name: "asc"
    }
  });
}

export async function getProperty(context: RequestContext, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      organizationId: context.effectiveOrganizationId,
      ...buildPropertyVisibilityWhere(context)
    },
    include: buildPropertyInclude(context)
  });

  assertCondition(property, 404, "Property not found.");
  return property;
}

export async function createProperty(context: RequestContext, input: PropertyCreateInput) {
  return prisma.property.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      name: input.name,
      street: input.street,
      postalCode: input.postalCode,
      city: input.city,
      country: input.country,
      type: input.type,
      yearBuilt: input.yearBuilt,
      notes: input.notes
    }
  });
}

export async function createUnit(context: RequestContext, propertyId: string, input: UnitCreateInput) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      organizationId: true
    }
  });

  assertCondition(property, 404, "Property not found.");
  assertSameOrganization(property.organizationId, context.effectiveOrganizationId);

  return prisma.unit.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      propertyId,
      label: input.label,
      floor: input.floor,
      notes: input.notes
    }
  });
}

export async function createPropertyContact(
  context: RequestContext,
  propertyId: string,
  input: PropertyContactCreateInput
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      organizationId: true
    }
  });

  assertCondition(property, 404, "Property not found.");
  assertSameOrganization(property.organizationId, context.effectiveOrganizationId);

  return prisma.propertyContact.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      propertyId,
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone,
      roleLabel: input.roleLabel
    }
  });
}

export async function addPropertyDocument(
  context: RequestContext,
  propertyId: string,
  file: { fileName: string; filePath: string; mimeType: string }
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      organizationId: true
    }
  });

  assertCondition(property, 404, "Property not found.");
  assertSameOrganization(property.organizationId, context.effectiveOrganizationId);

  return prisma.propertyDocument.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      propertyId,
      fileName: file.fileName,
      filePath: file.filePath,
      mimeType: file.mimeType,
      uploadedById: context.userId
    }
  });
}

export async function assignResidentToUnit(
  context: RequestContext,
  userId: string,
  propertyId: string,
  unitId?: string
) {
  const [user, property, unit] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true, role: true }
    }),
    prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, organizationId: true }
    }),
    unitId
      ? prisma.unit.findUnique({
          where: { id: unitId },
          select: { id: true, organizationId: true, propertyId: true }
        })
      : Promise.resolve(null)
  ]);

  assertCondition(user, 404, "User not found.");
  assertCondition(property, 404, "Property not found.");
  assertSameOrganization(user.organizationId ?? "", context.effectiveOrganizationId);
  assertSameOrganization(property.organizationId, context.effectiveOrganizationId);

  if (user.role !== "RESIDENT") {
    throw new AppError(400, "Only resident users can receive resident assignments.");
  }

  if (unit) {
    assertSameOrganization(unit.organizationId, context.effectiveOrganizationId);
    assertCondition(unit.propertyId === propertyId, 400, "Unit does not belong to property.");
  }

  return prisma.residentAssignment.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      userId,
      propertyId,
      unitId
    }
  });
}
