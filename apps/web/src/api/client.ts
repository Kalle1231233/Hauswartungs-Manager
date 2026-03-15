import type {
  AuthSession,
  ChecklistTemplateCreateInput,
  InvitationCreateInput,
  LoginInput,
  MaintenancePlanCreateInput,
  PropertyCreateInput,
  RegisterOrganizationInput,
  TicketCommentCreateInput,
  TicketCreateInput,
  TicketStatusUpdateInput,
  TimeEntryCreateInput
} from "@haus/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export type ClientSession = AuthSession;

async function request<TResponse>(
  path: string,
  options: RequestInit = {},
  session?: ClientSession | null
): Promise<TResponse> {
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: "Request failed." }));
    throw new Error(errorBody.message ?? "Request failed.");
  }

  return response.json() as Promise<TResponse>;
}

export const apiClient = {
  registerOrganization(input: RegisterOrganizationInput) {
    return request<AuthSession>("/auth/register-organization", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  login(input: LoginInput) {
    return request<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  logout(refreshToken: string) {
    return request<{ success: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },

  requestPasswordReset(email: string) {
    return request<{ success: boolean; previewToken?: string }>("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  },

  confirmPasswordReset(token: string, password: string) {
    return request<{ success: boolean }>("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, password })
    });
  },

  acceptInvitation(token: string, name: string, password: string) {
    return request<AuthSession>("/auth/accept-invitation", {
      method: "POST",
      body: JSON.stringify({ token, name, password })
    });
  },

  getCurrentUser(session: ClientSession) {
    return request("/auth/me", {}, session);
  },

  listUsers(session: ClientSession) {
    return request<
      Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        isActive: boolean;
      }>
    >("/auth/users", {}, session);
  },

  listInvitations(session: ClientSession) {
    return request<
      Array<{
        id: string;
        email: string;
        role: string;
        expiresAt: string;
        createdAt: string;
        invitedBy: { id: string; name: string };
      }>
    >("/auth/invitations", {}, session);
  },

  createInvitation(session: ClientSession, input: InvitationCreateInput) {
    return request<{ invitationId: string; expiresAt: string; previewToken?: string }>(
      "/auth/invitations",
      {
        method: "POST",
        body: JSON.stringify(input)
      },
      session
    );
  },

  updateUserActiveState(session: ClientSession, userId: string, isActive: boolean) {
    return request(`/auth/users/${userId}/active`, {
      method: "PATCH",
      body: JSON.stringify({ isActive })
    }, session);
  },

  listProperties(session: ClientSession) {
    return request<Array<Record<string, unknown>>>("/properties", {}, session);
  },

  createProperty(session: ClientSession, input: PropertyCreateInput) {
    return request("/properties", {
      method: "POST",
      body: JSON.stringify(input)
    }, session);
  },

  listTickets(session: ClientSession) {
    return request<Array<Record<string, unknown>>>("/tickets", {}, session);
  },

  getTicket(session: ClientSession, ticketId: string) {
    return request<Record<string, unknown>>(`/tickets/${ticketId}`, {}, session);
  },

  createTicket(session: ClientSession, input: TicketCreateInput) {
    return request("/tickets", {
      method: "POST",
      body: JSON.stringify(input)
    }, session);
  },

  addTicketComment(session: ClientSession, ticketId: string, input: TicketCommentCreateInput) {
    return request(`/tickets/${ticketId}/comments`, {
      method: "POST",
      body: JSON.stringify(input)
    }, session);
  },

  updateTicketStatus(session: ClientSession, ticketId: string, input: TicketStatusUpdateInput) {
    return request(`/tickets/${ticketId}/status`, {
      method: "POST",
      body: JSON.stringify(input)
    }, session);
  },

  createTicketChecklist(session: ClientSession, ticketId: string, templateId: string) {
    return request(`/tickets/${ticketId}/checklists`, {
      method: "POST",
      body: JSON.stringify({ templateId })
    }, session);
  },

  addTimeEntry(session: ClientSession, ticketId: string, input: TimeEntryCreateInput) {
    return request(`/tickets/${ticketId}/time-entries`, {
      method: "POST",
      body: JSON.stringify(input)
    }, session);
  },

  listMaintenancePlans(session: ClientSession) {
    return request<Array<Record<string, unknown>>>("/maintenance-plans", {}, session);
  },

  createMaintenancePlan(session: ClientSession, input: MaintenancePlanCreateInput) {
    return request("/maintenance-plans", {
      method: "POST",
      body: JSON.stringify(input)
    }, session);
  },

  generateDueMaintenance(session: ClientSession) {
    return request<{ generatedCount: number }>("/maintenance-plans/generate-due", {
      method: "POST",
      body: JSON.stringify({})
    }, session);
  },

  listChecklistTemplates(session: ClientSession) {
    return request<Array<Record<string, unknown>>>("/checklists/templates", {}, session);
  },

  createChecklistTemplate(session: ClientSession, input: ChecklistTemplateCreateInput) {
    return request("/checklists/templates", {
      method: "POST",
      body: JSON.stringify(input)
    }, session);
  },

  submitChecklistInstance(
    session: ClientSession,
    checklistInstanceId: string,
    input: {
      responses: Array<{ templateItemId: string; checked: boolean; comment?: string }>;
      summary?: string;
    }
  ) {
    return request(`/checklists/instances/${checklistInstanceId}/submit`, {
      method: "POST",
      body: JSON.stringify(input)
    }, session);
  },

  getOverview(session: ClientSession) {
    const path =
      session.user.role === "ORG_ADMIN" || session.user.role === "SUPER_ADMIN"
        ? "/overview/admin"
        : "/overview/technician";

    return request<Record<string, unknown>>(path, {}, session);
  }
};
