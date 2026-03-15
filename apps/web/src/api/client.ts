import type {
  AuthSession,
  ChecklistTemplateCreateInput,
  LoginInput,
  MaintenancePlanCreateInput,
  PropertyCreateInput,
  RegisterOrganizationInput,
  TicketCommentCreateInput,
  TicketCreateInput,
  TicketStatusUpdateInput
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

  getOverview(session: ClientSession) {
    const path =
      session.user.role === "ORG_ADMIN" || session.user.role === "SUPER_ADMIN"
        ? "/overview/admin"
        : "/overview/technician";

    return request<Record<string, unknown>>(path, {}, session);
  }
};
