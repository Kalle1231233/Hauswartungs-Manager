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
  responsibleUser?: { name?: string };
  activities?: Array<{
    id: string;
    type: string;
    message?: string | null;
    createdAt: string;
    actorUser?: { name?: string; role?: string };
    toStatus?: string | null;
  }>;
  checklistInstances?: Array<{
    id: string;
    status: "OPEN" | "COMPLETED";
    summary?: string | null;
    template: {
      id: string;
      name: string;
      items: Array<{ id: string; label: string; required: boolean }>;
    };
    responses: Array<{ templateItemId: string; checked: boolean; comment?: string | null }>;
  }>;
  timeEntries?: Array<{
    id: string;
    durationMinutes: number;
    note?: string | null;
    createdAt: string;
    user?: { name?: string };
  }>;
};

type ChecklistTemplateOption = {
  id: string;
  name: string;
  categoryLabel: string;
};

export function TicketsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const canChangeStatus = session?.user.role !== "RESIDENT";
  const canUseOperationalTools = session?.user.role !== "RESIDENT";

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

  const checklistTemplatesQuery = useQuery({
    queryKey: ["checklist-templates", "ticket-page"],
    queryFn: () => apiClient.listChecklistTemplates(session!),
    enabled: Boolean(session && canUseOperationalTools)
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
        queryClient.invalidateQueries({ queryKey: ["ticket", selectedTicketId] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] })
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

  const createChecklistMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.createTicketChecklist(
        session!,
        selectedTicketId!,
        String(formData.get("templateId") ?? "")
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ticket", selectedTicketId] });
    }
  });

  const submitChecklistMutation = useMutation({
    mutationFn: ({
      checklistInstanceId,
      formData,
      templateItems
    }: {
      checklistInstanceId: string;
      formData: FormData;
      templateItems: Array<{ id: string }>;
    }) =>
      apiClient.submitChecklistInstance(session!, checklistInstanceId, {
        summary: String(formData.get("summary") ?? "") || undefined,
        responses: templateItems.map((item) => ({
          templateItemId: item.id,
          checked: formData.get(`checked-${item.id}`) === "on",
          comment: String(formData.get(`comment-${item.id}`) ?? "") || undefined
        }))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ticket", selectedTicketId] });
    }
  });

  const timeEntryMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.addTimeEntry(session!, selectedTicketId!, {
        durationMinutes: Number(formData.get("durationMinutes") ?? 0),
        note: String(formData.get("note") ?? "") || undefined
      }),
    onSuccess: async () => {
      await Promise.all([
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
  const checklistTemplateOptions = ((checklistTemplatesQuery.data ?? []) as ChecklistTemplateOption[]).filter(
    Boolean
  );

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
                <span>{selectedTicket.responsibleUser?.name ?? "Nicht zugewiesen"}</span>
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

              {canUseOperationalTools ? (
                <>
                  <div className="divider" />

                  <h4>Checklisten</h4>
                  <form
                    className="form-grid compact-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void createChecklistMutation
                        .mutateAsync(new FormData(event.currentTarget))
                        .then(() => event.currentTarget.reset());
                    }}
                  >
                    <label>
                      <span>Template anhaengen</span>
                      <select name="templateId" required>
                        <option value="">Bitte waehlen</option>
                        {checklistTemplateOptions.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.categoryLabel})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button disabled={createChecklistMutation.isPending} type="submit">
                      Checkliste anlegen
                    </button>
                  </form>

                  <div className="stack">
                    {selectedTicket.checklistInstances?.map((instance) => (
                      <article className="list-card" key={instance.id}>
                        <div className="meta-row">
                          <strong>{instance.template.name}</strong>
                          <span className={`badge ${instance.status === "COMPLETED" ? "subtle" : ""}`}>
                            {instance.status}
                          </span>
                        </div>

                        {instance.status === "OPEN" ? (
                          <form
                            className="form-grid"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void submitChecklistMutation.mutateAsync({
                                checklistInstanceId: instance.id,
                                formData: new FormData(event.currentTarget),
                                templateItems: instance.template.items
                              });
                            }}
                          >
                            {instance.template.items.map((item) => {
                              const existingResponse = instance.responses.find(
                                (response) => response.templateItemId === item.id
                              );

                              return (
                                <div className="checklist-row" key={item.id}>
                                  <label className="checkbox-label">
                                    <input
                                      defaultChecked={existingResponse?.checked ?? false}
                                      name={`checked-${item.id}`}
                                      type="checkbox"
                                    />
                                    <span>
                                      {item.label} {item.required ? "*" : ""}
                                    </span>
                                  </label>
                                  <input
                                    defaultValue={existingResponse?.comment ?? ""}
                                    name={`comment-${item.id}`}
                                    placeholder="Kommentar"
                                  />
                                </div>
                              );
                            })}
                            <label>
                              <span>Zusammenfassung</span>
                              <textarea defaultValue={instance.summary ?? ""} name="summary" rows={3} />
                            </label>
                            <button disabled={submitChecklistMutation.isPending} type="submit">
                              Checkliste abschliessen
                            </button>
                          </form>
                        ) : (
                          <div className="stack">
                            {instance.template.items.map((item) => {
                              const response = instance.responses.find(
                                (entry) => entry.templateItemId === item.id
                              );

                              return (
                                <div className="checklist-row readonly" key={item.id}>
                                  <strong>{item.label}</strong>
                                  <span className="muted">
                                    {response?.checked ? "Erledigt" : "Nicht erledigt"}
                                  </span>
                                  {response?.comment ? <p>{response.comment}</p> : null}
                                </div>
                              );
                            })}
                            {instance.summary ? (
                              <div className="timeline-item">
                                <strong>Zusammenfassung</strong>
                                <p>{instance.summary}</p>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </article>
                    ))}
                    {!selectedTicket.checklistInstances?.length ? (
                      <p className="muted">Noch keine Checklisten mit diesem Ticket verknuepft.</p>
                    ) : null}
                  </div>

                  <div className="divider" />

                  <h4>Zeiterfassung</h4>
                  <form
                    className="form-grid compact-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void timeEntryMutation.mutateAsync(new FormData(event.currentTarget)).then(() => {
                        event.currentTarget.reset();
                      });
                    }}
                  >
                    <label>
                      <span>Dauer in Minuten</span>
                      <input min={1} name="durationMinutes" type="number" required />
                    </label>
                    <label className="wide">
                      <span>Notiz</span>
                      <textarea name="note" rows={2} />
                    </label>
                    <button disabled={timeEntryMutation.isPending} type="submit">
                      Zeit buchen
                    </button>
                  </form>
                </>
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

              <div className="divider" />

              <h4>Gebuchte Zeiten</h4>
              {selectedTicket.timeEntries?.map((entry) => (
                <div className="timeline-item" key={entry.id}>
                  <strong>{entry.durationMinutes} Minuten</strong>
                  <span className="muted">
                    {entry.user?.name ?? "Unbekannt"} - {entry.createdAt.slice(0, 16)}
                  </span>
                  {entry.note ? <p>{entry.note}</p> : null}
                </div>
              ))}
              {!selectedTicket.timeEntries?.length ? (
                <p className="muted">Noch keine Zeiten erfasst.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
