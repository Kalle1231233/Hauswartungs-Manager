import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TicketStatus } from "@haus/shared";

import { apiClient } from "../api/client";
import { useAuth } from "../features/auth/auth-context";

type TicketListItem = {
  id: string;
  title: string;
  status: TicketStatus;
  category: string;
  priority: string;
  property?: { name?: string };
  responsibleUser?: { name?: string };
};

type TicketDetail = TicketListItem & {
  description?: string;
  activities?: Array<{
    id: string;
    type: string;
    message?: string | null;
    createdAt: string;
    actorUser?: { name?: string; role?: string };
    toStatus?: string | null;
  }>;
};

export function TicketsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const canChangeStatus = session?.user.role !== "RESIDENT";

  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: () => apiClient.listTickets(session!),
    enabled: Boolean(session)
  });

  const propertiesQuery = useQuery({
    queryKey: ["properties", "options"],
    queryFn: () => apiClient.listProperties(session!),
    enabled: Boolean(session)
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.listUsers(session!),
    enabled: Boolean(session && (session.user.role === "ORG_ADMIN" || session.user.role === "SUPER_ADMIN"))
  });

  const selectedTicketQuery = useQuery({
    queryKey: ["ticket", selectedTicketId],
    queryFn: () => apiClient.getTicket(session!, selectedTicketId!),
    enabled: Boolean(session && selectedTicketId)
  });

  const createTicketMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.createTicket(session!, {
        propertyId: String(formData.get("propertyId") ?? ""),
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        category: String(formData.get("category") ?? "DAMAGE") as
          | "DAMAGE"
          | "MAINTENANCE"
          | "INSPECTION"
          | "OTHER",
        priority: String(formData.get("priority") ?? "MEDIUM") as
          | "LOW"
          | "MEDIUM"
          | "HIGH"
          | "CRITICAL",
        dueDate: formData.get("dueDate")
          ? new Date(String(formData.get("dueDate"))).toISOString()
          : undefined,
        responsibleUserId: String(formData.get("responsibleUserId") ?? "") || undefined
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    }
  });

  const commentMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.addTicketComment(session!, selectedTicketId!, {
        message: String(formData.get("message") ?? "")
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["ticket", selectedTicketId] })
      ]);
    }
  });

  const statusMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.updateTicketStatus(session!, selectedTicketId!, {
        status: String(formData.get("status") ?? "IN_PROGRESS") as TicketStatus,
        note: String(formData.get("note") ?? "") || undefined
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["ticket", selectedTicketId] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] })
      ]);
    }
  });

  const tickets = (ticketsQuery.data ?? []) as TicketListItem[];
  const selectedTicket = (selectedTicketQuery.data ?? null) as TicketDetail | null;

  const propertyOptions = useMemo(
    () =>
      ((propertiesQuery.data ?? []) as Array<{ id: string; name: string }>).map((property) => ({
        id: property.id,
        name: property.name
      })),
    [propertiesQuery.data]
  );

  const userOptions = ((usersQuery.data ?? []) as Array<{ id: string; name: string }>).filter(Boolean);

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Ticketsystem</p>
          <h2>Schaeden, Maengel und operative Aufgaben</h2>
        </div>
      </section>

      <section className="grid-2">
        <article className="card">
          <h3>Neues Ticket</h3>
          <form
            className="form-grid compact-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void createTicketMutation.mutateAsync(new FormData(event.currentTarget)).then(() => {
                event.currentTarget.reset();
              });
            }}
          >
            <label>
              <span>Objekt</span>
              <select name="propertyId" required>
                <option value="">Bitte waehlen</option>
                {propertyOptions.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Kategorie</span>
              <select defaultValue="DAMAGE" name="category">
                <option value="DAMAGE">Schaden</option>
                <option value="MAINTENANCE">Wartung</option>
                <option value="INSPECTION">Kontrolle</option>
                <option value="OTHER">Sonstiges</option>
              </select>
            </label>
            <label>
              <span>Prioritaet</span>
              <select defaultValue="MEDIUM" name="priority">
                <option value="LOW">Niedrig</option>
                <option value="MEDIUM">Mittel</option>
                <option value="HIGH">Hoch</option>
                <option value="CRITICAL">Kritisch</option>
              </select>
            </label>
            {userOptions.length ? (
              <label>
                <span>Verantwortlich</span>
                <select name="responsibleUserId">
                  <option value="">Noch nicht zuweisen</option>
                  {userOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="wide">
              <span>Titel</span>
              <input name="title" placeholder="Wasserschaden im Keller" required />
            </label>
            <label className="wide">
              <span>Beschreibung</span>
              <textarea name="description" rows={4} required />
            </label>
            <label>
              <span>Faelligkeit</span>
              <input name="dueDate" type="date" />
            </label>
            <button disabled={createTicketMutation.isPending} type="submit">
              {createTicketMutation.isPending ? "Speichert..." : "Ticket anlegen"}
            </button>
          </form>
        </article>

        <article className="card">
          <h3>Ticketliste</h3>
          <div className="stack">
            {tickets.map((ticket) => (
              <button
                className={`list-item selectable ${selectedTicketId === ticket.id ? "selected" : ""}`}
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                type="button"
              >
                <strong>{ticket.title}</strong>
                <span className="muted">
                  {ticket.property?.name ?? "-"} - {ticket.status} - {ticket.priority}
                </span>
              </button>
            ))}
            {tickets.length === 0 ? <p className="muted">Keine Tickets vorhanden.</p> : null}
          </div>
        </article>
      </section>

      <section className="card">
        <h3>Ticket-Detail</h3>
        {!selectedTicketId ? (
          <p className="muted">Waehlen Sie ein Ticket aus der Liste aus.</p>
        ) : selectedTicketQuery.isLoading ? (
          <p>Lade Detailansicht...</p>
        ) : selectedTicketQuery.isError ? (
          <p className="alert error">{selectedTicketQuery.error.message}</p>
        ) : selectedTicket ? (
          <div className="detail-grid">
            <div className="stack">
              <h4>{selectedTicket.title}</h4>
              <p>{selectedTicket.description}</p>
              <div className="meta-row">
                <span className="badge">{selectedTicket.status}</span>
                <span>{selectedTicket.category}</span>
                <span>{selectedTicket.priority}</span>
              </div>

              <form
                className="form-grid compact-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commentMutation.mutateAsync(new FormData(event.currentTarget)).then(() => {
                    event.currentTarget.reset();
                  });
                }}
              >
                <label className="wide">
                  <span>Kommentar</span>
                  <textarea name="message" rows={3} required />
                </label>
                <button disabled={commentMutation.isPending} type="submit">
                  Kommentar speichern
                </button>
              </form>

              {canChangeStatus ? (
                <form
                  className="form-grid compact-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void statusMutation.mutateAsync(new FormData(event.currentTarget));
                  }}
                >
                  <label>
                    <span>Status</span>
                    <select defaultValue={selectedTicket.status} name="status">
                      <option value="NEW">Neu</option>
                      <option value="ASSIGNED">Zugewiesen</option>
                      <option value="IN_PROGRESS">In Bearbeitung</option>
                      <option value="WAITING_FOR_FEEDBACK">Wartet auf Rueckmeldung</option>
                      <option value="DONE">Erledigt</option>
                      <option value="CLOSED">Geschlossen</option>
                    </select>
                  </label>
                  <label className="wide">
                    <span>Notiz</span>
                    <textarea name="note" rows={2} />
                  </label>
                  <button disabled={statusMutation.isPending} type="submit">
                    Status aktualisieren
                  </button>
                </form>
              ) : null}
            </div>

            <div className="stack">
              <h4>Timeline</h4>
              {selectedTicket.activities?.map((activity) => (
                <div className="timeline-item" key={activity.id}>
                  <strong>{activity.type}</strong>
                  <span className="muted">
                    {activity.actorUser?.name ?? "System"} - {activity.createdAt.slice(0, 16)}
                  </span>
                  {activity.message ? <p>{activity.message}</p> : null}
                  {activity.toStatus ? (
                    <span className="badge subtle">{activity.toStatus}</span>
                  ) : null}
                </div>
              ))}
              {!selectedTicket.activities?.length ? (
                <p className="muted">Noch keine Timeline-Eintraege vorhanden.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
