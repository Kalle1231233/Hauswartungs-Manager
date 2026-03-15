import { z } from "zod";

export const roleSchema = z.enum([
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "TECHNICIAN",
  "RESIDENT",
  "SERVICE_PROVIDER"
]);

export const propertyTypeSchema = z.enum(["VILLA", "MULTI_FAMILY", "OTHER"]);
export const ticketCategorySchema = z.enum(["DAMAGE", "MAINTENANCE", "INSPECTION", "OTHER"]);
export const ticketPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const ticketStatusSchema = z.enum([
  "NEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_FEEDBACK",
  "DONE",
  "CLOSED"
]);
export const maintenanceCategorySchema = z.enum([
  "SMOKE_DETECTOR",
  "HEATING",
  "TREE_INSPECTION",
  "STAIRWAY_INSPECTION",
  "WINTER_SERVICE",
  "OTHER"
]);

export type Role = z.infer<typeof roleSchema>;
export type PropertyType = z.infer<typeof propertyTypeSchema>;
export type TicketCategory = z.infer<typeof ticketCategorySchema>;
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type MaintenanceCategory = z.infer<typeof maintenanceCategorySchema>;

export const registerOrganizationSchema = z.object({
  organizationName: z.string().min(2).max(120),
  contactEmail: z.email(),
  adminName: z.string().min(2).max(120),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128)
});

export const invitationCreateSchema = z.object({
  email: z.email(),
  role: roleSchema.exclude(["SUPER_ADMIN"])
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(20),
  name: z.string().min(2).max(120),
  password: z.string().min(8).max(128)
});

export const passwordResetRequestSchema = z.object({
  email: z.email()
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128)
});

export const propertyCreateSchema = z.object({
  name: z.string().min(2).max(160),
  street: z.string().min(2).max(160),
  postalCode: z.string().min(3).max(16),
  city: z.string().min(2).max(120),
  country: z.string().min(2).max(80).default("DE"),
  type: propertyTypeSchema,
  yearBuilt: z.number().int().min(1800).max(2300).optional(),
  notes: z.string().max(4000).optional()
});

export const unitCreateSchema = z.object({
  label: z.string().min(1).max(80),
  floor: z.string().max(40).optional(),
  notes: z.string().max(1000).optional()
});

export const propertyContactCreateSchema = z.object({
  name: z.string().min(2).max(120),
  company: z.string().max(120).optional(),
  email: z.email().optional(),
  phone: z.string().max(40).optional(),
  roleLabel: z.string().min(2).max(120)
});

export const ticketCreateSchema = z.object({
  propertyId: z.string().cuid(),
  unitId: z.string().cuid().optional(),
  title: z.string().min(3).max(160),
  description: z.string().min(5).max(4000),
  category: ticketCategorySchema,
  priority: ticketPrioritySchema,
  dueDate: z.string().datetime().optional(),
  responsibleUserId: z.string().cuid().optional()
});

export const ticketAssignSchema = z.object({
  responsibleUserId: z.string().cuid()
});

export const ticketStatusUpdateSchema = z.object({
  status: ticketStatusSchema,
  note: z.string().max(1000).optional()
});

export const ticketCommentCreateSchema = z.object({
  message: z.string().min(1).max(4000)
});

export const maintenancePlanCreateSchema = z.object({
  propertyId: z.string().cuid(),
  title: z.string().min(3).max(160),
  category: maintenanceCategorySchema,
  description: z.string().max(2000).optional(),
  intervalMonths: z.number().int().min(1).max(60),
  nextDueDate: z.string().datetime(),
  responsibleUserId: z.string().cuid().optional(),
  responsibleRole: roleSchema.exclude(["SUPER_ADMIN"]).optional()
});

export const checklistTemplateCreateSchema = z.object({
  name: z.string().min(2).max(160),
  category: maintenanceCategorySchema.or(ticketCategorySchema),
  items: z.array(
    z.object({
      label: z.string().min(2).max(240),
      required: z.boolean().default(true)
    })
  ).min(1)
});

export const checklistInstanceCreateSchema = z.object({
  ticketId: z.string().cuid(),
  templateId: z.string().cuid()
});

export const checklistSubmitSchema = z.object({
  responses: z.array(
    z.object({
      templateItemId: z.string().cuid(),
      checked: z.boolean(),
      comment: z.string().max(1000).optional()
    })
  ).min(1),
  summary: z.string().max(2000).optional()
});

export const timeEntryCreateSchema = z.object({
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  note: z.string().max(1000).optional()
}).refine(
  (value) => Boolean(value.durationMinutes) || Boolean(value.startedAt && value.endedAt),
  "Either durationMinutes or startedAt and endedAt are required."
);

export type RegisterOrganizationInput = z.infer<typeof registerOrganizationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;
export type UnitCreateInput = z.infer<typeof unitCreateSchema>;
export type PropertyContactCreateInput = z.infer<typeof propertyContactCreateSchema>;
export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;
export type TicketAssignInput = z.infer<typeof ticketAssignSchema>;
export type TicketStatusUpdateInput = z.infer<typeof ticketStatusUpdateSchema>;
export type TicketCommentCreateInput = z.infer<typeof ticketCommentCreateSchema>;
export type MaintenancePlanCreateInput = z.infer<typeof maintenancePlanCreateSchema>;
export type ChecklistTemplateCreateInput = z.infer<typeof checklistTemplateCreateSchema>;
export type ChecklistSubmitInput = z.infer<typeof checklistSubmitSchema>;
export type TimeEntryCreateInput = z.infer<typeof timeEntryCreateSchema>;

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    organizationId: string | null;
    name: string;
    email: string;
    role: Role;
  };
};
