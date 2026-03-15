import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { useAuth } from "../features/auth/auth-context";

export function DashboardPage() {
  const { session } = useAuth();

  const overviewQuery = useQuery({
    queryKey: ["overview", session?.user.role],
    queryFn: () => apiClient.getOverview(session!),
    enabled: Boolean(session)
  });

  if (overviewQuery.isLoading) {
    return <section className="card">Dashboard wird geladen...</section>;
  }

  if (overviewQuery.isError) {
    return (
      <section className="card">
        Fehler beim Laden des Dashboards: {overviewQuery.error.message}
      </section>
    );
  }

  const data = overviewQuery.data ?? {};
  const tickets = Array.isArray(data.tickets) ? data.tickets : [];
  const maintenancePlans = Array.isArray(data.maintenancePlans) ? data.maintenancePlans : [];
  const maintenanceOccurrences = Array.isArray(data.maintenanceOccurrences)
    ? data.maintenanceOccurrences
    : [];
  const timeSummary = Array.isArray(data.timeSummary) ? data.timeSummary : [];

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Uebersicht</p>
          <h2>Willkommen zur Einsatz- und Objektsteuerung</h2>
        </div>
      </section>

      <section className="stats-grid">
        <article className="card">
          <h3>Offene Tickets</h3>
          <p className="stat">{tickets.length}</p>
        </article>
        <article className="card">
          <h3>Faellige Wartungen</h3>
          <p className="stat">{maintenanceOccurrences.length || maintenancePlans.length}</p>
        </article>
        <article className="card">
          <h3>Zeitsumme Buckets</h3>
          <p className="stat">{timeSummary.length}</p>
        </article>
      </section>

      <section className="grid-2">
        <article className="card">
          <h3>Naechste Aufgaben</h3>
          <div className="stack">
            {tickets.slice(0, 6).map((ticket) => (
              <div className="list-item" key={String((ticket as { id: string }).id)}>
                <strong>{String((ticket as { title?: string }).title ?? "Ticket")}</strong>
                <span className="muted">
                  Status: {String((ticket as { status?: string }).status ?? "-")}
                </span>
              </div>
            ))}
            {tickets.length === 0 ? <p className="muted">Keine offenen Tickets vorhanden.</p> : null}
          </div>
        </article>

        <article className="card">
          <h3>Wartungsfokus</h3>
          <div className="stack">
            {(maintenanceOccurrences.length ? maintenanceOccurrences : maintenancePlans)
              .slice(0, 6)
              .map((entry) => (
                <div className="list-item" key={String((entry as { id: string }).id)}>
                  <strong>
                    {String((entry as { title?: string; maintenancePlan?: { title?: string } }).title ??
                      (entry as { maintenancePlan?: { title?: string } }).maintenancePlan?.title ??
                      "Wartung")}
                  </strong>
                  <span className="muted">
                    Faellig:{" "}
                    {String(
                      (entry as { dueDate?: string; nextDueDate?: string }).dueDate ??
                        (entry as { dueDate?: string; nextDueDate?: string }).nextDueDate ??
                        "-"
                    ).slice(0, 10)}
                  </span>
                </div>
              ))}
            {maintenanceOccurrences.length === 0 && maintenancePlans.length === 0 ? (
              <p className="muted">Noch keine Wartungsdaten vorhanden.</p>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
