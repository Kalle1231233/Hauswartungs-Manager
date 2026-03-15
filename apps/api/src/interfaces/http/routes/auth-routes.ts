import { Router } from "express";
import { z } from "zod";

import {
  acceptInvitationSchema,
  invitationCreateSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerOrganizationSchema
} from "@haus/shared";

import {
  acceptInvitation,
  getCurrentUser,
  inviteUser,
  listOrganizationUsers,
  login,
  logout,
  refreshSession,
  registerOrganization,
  requestPasswordReset,
  resetPassword,
  updateUserActiveState
} from "../../../application/auth/auth-service.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { asyncHandler } from "../utils/async-handler.js";
import { getRequestContext } from "../utils/request-context.js";

const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

const userIdParamSchema = z.object({
  userId: z.string().cuid()
});

const updateUserActiveSchema = z.object({
  isActive: z.boolean()
});

export const authRouter = Router();

authRouter.post(
  "/register-organization",
  asyncHandler(async (request, response) => {
    const input = registerOrganizationSchema.parse(request.body);
    const session = await registerOrganization(input);
    response.status(201).json(session);
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (request, response) => {
    const input = loginSchema.parse(request.body);
    const session = await login(input);
    response.json(session);
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (request, response) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const session = await refreshSession(refreshToken);
    response.json(session);
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (request, response) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    const result = await logout(refreshToken);
    response.json(result);
  })
);

authRouter.post(
  "/password-reset/request",
  asyncHandler(async (request, response) => {
    const input = passwordResetRequestSchema.parse(request.body);
    const result = await requestPasswordReset(input.email);
    response.json(result);
  })
);

authRouter.post(
  "/password-reset/confirm",
  asyncHandler(async (request, response) => {
    const input = passwordResetConfirmSchema.parse(request.body);
    const result = await resetPassword(input.token, input.password);
    response.json(result);
  })
);

authRouter.post(
  "/accept-invitation",
  asyncHandler(async (request, response) => {
    const input = acceptInvitationSchema.parse(request.body);
    const session = await acceptInvitation(input.token, input.name, input.password);
    response.json(session);
  })
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (request, response) => {
    const user = await getCurrentUser(getRequestContext(request));
    response.json(user);
  })
);

authRouter.get(
  "/users",
  authenticate,
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const users = await listOrganizationUsers(getRequestContext(request));
    response.json(users);
  })
);

authRouter.post(
  "/invitations",
  authenticate,
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const input = invitationCreateSchema.parse(request.body);
    const invitation = await inviteUser(getRequestContext(request), input);
    response.status(201).json(invitation);
  })
);

authRouter.patch(
  "/users/:userId/active",
  authenticate,
  authorize("ORG_ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (request, response) => {
    const input = updateUserActiveSchema.parse(request.body);
    const { userId } = userIdParamSchema.parse(request.params);
    const user = await updateUserActiveState(
      getRequestContext(request),
      userId,
      input.isActive
    );
    response.json(user);
  })
);
