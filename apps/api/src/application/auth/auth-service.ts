import type { AuthSession, InvitationCreateInput, LoginInput, RegisterOrganizationInput, Role } from "@haus/shared";

import { prisma } from "../../infrastructure/database/prisma.js";
import { hashPassword, verifyPassword } from "../../infrastructure/security/password.js";
import {
  createOpaqueToken,
  hashOpaqueToken,
  signAccessToken
} from "../../infrastructure/security/tokens.js";
import { env } from "../../config/env.js";
import { AppError, assertCondition } from "../common/errors.js";
import type { RequestContext } from "../common/tenant.js";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function sanitizeUser(user: {
  id: string;
  organizationId: string | null;
  name: string;
  email: string;
  role: Role;
}) {
  return {
    id: user.id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

async function createSessionForUser(userId: string): Promise<AuthSession> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      email: true,
      role: true,
      isActive: true
    }
  });

  assertCondition(user?.isActive, 401, "User account is inactive or missing.");

  const refreshToken = createOpaqueToken();
  const refreshTokenHash = hashOpaqueToken(refreshToken);

  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: addDays(new Date(), env.refreshTokenTtlDays)
    }
  });

  const accessToken = signAccessToken({
    sub: user.id,
    organizationId: user.organizationId,
    role: user.role,
    email: user.email,
    name: user.name
  });

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user)
  };
}

export async function registerOrganization(input: RegisterOrganizationInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.contactEmail.toLowerCase() },
    select: { id: true }
  });

  assertCondition(!existingUser, 409, "A user with this e-mail already exists.");

  const passwordHash = await hashPassword(input.password);

  const { userId } = await prisma.$transaction(async (transaction) => {
    const organization = await transaction.organization.create({
      data: {
        name: input.organizationName,
        contactEmail: input.contactEmail.toLowerCase()
      }
    });

    const adminUser = await transaction.user.create({
      data: {
        organizationId: organization.id,
        role: "ORG_ADMIN",
        name: input.adminName,
        email: input.contactEmail.toLowerCase(),
        passwordHash
      }
    });

    await transaction.auditLog.create({
      data: {
        organizationId: organization.id,
        actorUserId: adminUser.id,
        action: "organization.registered",
        entityType: "Organization",
        entityId: organization.id,
        metadata: {
          name: organization.name
        }
      }
    });

    return { userId: adminUser.id };
  });

  return createSessionForUser(userId);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: {
      id: true,
      organizationId: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      passwordHash: true
    }
  });

  assertCondition(user?.isActive, 401, "Invalid credentials.");

  const isValid = await verifyPassword(input.password, user.passwordHash);
  assertCondition(isValid, 401, "Invalid credentials.");

  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id
    }
  });

  return createSessionForUser(user.id);
}

export async function refreshSession(refreshToken: string) {
  const tokenHash = hashOpaqueToken(refreshToken);
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          isActive: true,
          organizationId: true
        }
      }
    }
  });

  assertCondition(session, 401, "Invalid refresh token.");
  assertCondition(!session.revokedAt, 401, "Refresh token already revoked.");
  assertCondition(session.expiresAt > new Date(), 401, "Refresh token expired.");
  assertCondition(session.user.isActive, 401, "User account is inactive.");

  await prisma.refreshSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() }
  });

  return createSessionForUser(session.user.id);
}

export async function logout(refreshToken: string) {
  const tokenHash = hashOpaqueToken(refreshToken);

  await prisma.refreshSession.updateMany({
    where: {
      tokenHash,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });

  return { success: true };
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      organizationId: true,
      isActive: true
    }
  });

  if (!user?.isActive) {
    return { success: true };
  }

  const token = createOpaqueToken();
  const tokenHash = hashOpaqueToken(token);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: addMinutes(new Date(), env.passwordResetTtlMinutes)
    }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: "auth.password_reset_requested",
      entityType: "User",
      entityId: user.id
    }
  });

  return {
    success: true,
    previewToken: env.nodeEnv === "production" ? undefined : token
  };
}

export async function resetPassword(token: string, password: string) {
  const tokenHash = hashOpaqueToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          organizationId: true
        }
      }
    }
  });

  assertCondition(resetToken, 400, "Invalid reset token.");
  assertCondition(!resetToken.usedAt, 400, "Reset token already used.");
  assertCondition(resetToken.expiresAt > new Date(), 400, "Reset token expired.");

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.user.id },
      data: { passwordHash }
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    }),
    prisma.refreshSession.updateMany({
      where: {
        userId: resetToken.user.id,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    }),
    prisma.auditLog.create({
      data: {
        organizationId: resetToken.user.organizationId,
        actorUserId: resetToken.user.id,
        action: "auth.password_reset_completed",
        entityType: "User",
        entityId: resetToken.user.id
      }
    })
  ]);

  return { success: true };
}

export async function inviteUser(context: RequestContext, input: InvitationCreateInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: { id: true }
  });

  assertCondition(!existingUser, 409, "A user with this e-mail already exists.");

  const token = createOpaqueToken();
  const tokenHash = hashOpaqueToken(token);

  const invitation = await prisma.invitation.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      email: input.email.toLowerCase(),
      role: input.role,
      tokenHash,
      invitedById: context.userId,
      expiresAt: addDays(new Date(), env.invitationTtlDays)
    }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      actorUserId: context.userId,
      action: "organization.invitation_created",
      entityType: "Invitation",
      entityId: invitation.id,
      metadata: {
        email: invitation.email,
        role: invitation.role
      }
    }
  });

  return {
    invitationId: invitation.id,
    expiresAt: invitation.expiresAt,
    previewToken: env.nodeEnv === "production" ? undefined : token
  };
}

export async function acceptInvitation(token: string, name: string, password: string) {
  const tokenHash = hashOpaqueToken(token);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: {
      organization: {
        select: { id: true }
      }
    }
  });

  assertCondition(invitation, 400, "Invalid invitation token.");
  assertCondition(!invitation.acceptedAt, 400, "Invitation already accepted.");
  assertCondition(invitation.expiresAt > new Date(), 400, "Invitation expired.");

  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true }
  });
  assertCondition(!existingUser, 409, "A user with this e-mail already exists.");

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (transaction) => {
    const createdUser = await transaction.user.create({
      data: {
        organizationId: invitation.organization.id,
        role: invitation.role,
        name,
        email: invitation.email,
        passwordHash
      }
    });

    await transaction.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() }
    });

    await transaction.auditLog.create({
      data: {
        organizationId: invitation.organization.id,
        actorUserId: createdUser.id,
        action: "organization.invitation_accepted",
        entityType: "Invitation",
        entityId: invitation.id
      }
    });

    return createdUser;
  });

  return createSessionForUser(user.id);
}

export async function getCurrentUser(context: RequestContext) {
  const user = await prisma.user.findUnique({
    where: { id: context.userId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      email: true,
      role: true,
      isActive: true
    }
  });

  assertCondition(user?.isActive, 404, "User not found.");
  return sanitizeUser(user);
}

export async function listOrganizationUsers(context: RequestContext) {
  return prisma.user.findMany({
    where: {
      organizationId: context.effectiveOrganizationId
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      email: true,
      role: true,
      isActive: true
    },
    orderBy: {
      name: "asc"
    }
  });
}

export async function updateUserActiveState(
  context: RequestContext,
  userId: string,
  isActive: boolean
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      organizationId: true
    }
  });

  assertCondition(user, 404, "User not found.");
  assertCondition(user.organizationId === context.effectiveOrganizationId, 404, "User not found.");

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: {
      id: true,
      organizationId: true,
      name: true,
      email: true,
      role: true,
      isActive: true
    }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: context.effectiveOrganizationId,
      actorUserId: context.userId,
      action: isActive ? "user.activated" : "user.deactivated",
      entityType: "User",
      entityId: userId
    }
  });

  return updatedUser;
}
