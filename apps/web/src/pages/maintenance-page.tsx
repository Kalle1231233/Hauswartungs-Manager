import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { useAuth } from "../features/auth/auth-context";

type MaintenancePlanRecord = {
  id: string;
  title: string;
  category: string;
  nextDueDate: string;
  property?: { name?: string };
  occurrences?: Array<{ id: string; dueDate?: string; status?: string }>;
};

type ChecklistTemplateRecord = {
  id: string;
  name: string;
  categoryLabel: string;
  items?: Array<{ id: string }>;
};

export function MaintenancePage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = session?.user.role === "ORG_ADMIN" || session?.user.role === "SUPER_ADMIN";

  const maintenanceQuery = useQuery({
    queryKey: ["maintenance-plans"],
    queryFn: () => apiClient.listMaintenancePlans(session!),
    enabled: Boolean(session)
  });

  const propertiesQuery = useQuery({
    queryKey: ["properties", "maintenance"],
    queryFn: () => apiClient.listProperties(session!),
    enabled: Boolean(session)
  });

  const templatesQuery = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: () => apiClient.listChecklistTemplates(session!),
    enabled: Boolean(session)
  });

  const createPlanMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.createMaintenancePlan(session!, {
        propertyId: String(formData.get("propertyId") ?? ""),
        title: String(formData.get("title") ?? ""),
        category: String(formData.get("category") ?? "OTHER") as
          | "SMOKE_DETECTOR"
          | "HEATING"
          | "TREE_INSPECTION"
          | "STAIRWAY_INSPECTION"
          | "WINTER_SERVICE"
          | "OTHER",
        description: String(formData.get("description") ?? "") || undefined,
        intervalMonths: Number(formData.get("intervalMonths") ?? 12),
        nextDueDate: new Date(String(formData.get("nextDueDate") ?? "")).toISOString()
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["maintenance-plans"] });
    }
  });

  const createTemplateMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.createChecklistTemplate(session!, {
        name: String(formData.get("name") ?? ""),
        category: String(formData.get("category") ?? "OTHER") as
          | "SMOKE_DETECTOR"
          | "HEATING"
          | "TREE_INSPECTION"
          | "STAIRWAY_INSPECTION"
          | "WINTER_SERVICE"
          | "OTHER"
          | "DAMAGE"
          | "MAINTENANCE"
          | "INSPECTION",
        items: String(formData.get("items") ?? "")
          .split("\n")
          .map((label) => label.trim())
          .filter(Boolean)
          .map((label) => ({ label, required: true }))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
    }
  });

  const generateMutation = useMutation({
    mutationFn: () => apiClient.generateDueMaintenance(session!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["maintenance-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"] })
      ]);
    }
  });

  const maintenancePlans = (maintenanceQuery.data ?? []) as MaintenancePlanRecord[];
  const templates = (templatesQuery.data ?? []) as ChecklistTemplateRecord[];
  const properties = (propertiesQuery.data ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Wartung und Nachweise</p>
          <h2>Pruefpflichten, Wiederkehrer und Checklisten</h2>
        </div>
        {isAdmin ? (
          <button
            disabled={generateMutation.isPending}
            onClick={() => void generateMutation.mutateAsync()}
            type="button"
          >
            Faellige Wartungen erzeugen
          </button>
        ) : null}
      </section>

      {isAdmin ? (
        <section className="grid-2">
          <article className="card">
            <h3>Wartungsplan anlegen</h3>
            <form
              className="form-grid compact-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void createPlanMutation.mutateAsync(new FormData(event.currentTarget)).then(() => {
                  event.currentTarget.reset();
                });
              }}
            >
              <label>
                <span>Objekt</span>
                <select name="propertyId" required>
                  <option value="">Bitte waehlen</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Kategorie</span>
                <select defaultValue="SMOKE_DETECTOR" name="category">
                  <option value="SMOKE_DETECTOR">Rauchmelderpruefung</option>
                  <option value="HEATING">Heizungswartung</option>
                  <option value="TREE_INSPECTION">Baumkontrolle</option>
                  <option value="STAIRWAY_INSPECTION">Treppenhauskontrolle</option>
                  <option value="WINTER_SERVICE">Winterdienst</option>
                  <option value="OTHER">Sonstiges</option>
                </select>
              </label>
              <label className="wide">
                <span>Titel</span>
                <input name="title" placeholder="Rauchmelderpruefung Haus A" required />
              </label>
              <label>
                <span>Intervall in Monaten</span>
                <input defaultValue={12} min={1} name="intervalMonths" type="number" required />
              </label>
              <label>
                <span>Naechste Faelligkeit</span>
                <input name="nextDueDate" type="date" required />
              </label>
              <label className="wide">
                <span>Beschreibung</span>
                <textarea name="description" rows={3} />
              </label>
              <button disabled={createPlanMutation.isPending} type="submit">
                Wartungsplan speichern
              </button>
            </form>
          </article>

          <article className="card">
            <h3>Checklisten-Template anlegen</h3>
            <form
              className="form-grid compact-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void createTemplateMutation
                  .mutateAsync(new FormData(event.currentTarget))
                  .then(() => {
                    event.currentTarget.reset();
                  });
              }}
            >
              <label>
                <span>Name</span>
                <input name="name" placeholder="Treppenhauskontrolle" required />
              </label>
              <label>
                <span>Kategorie</span>
                <select defaultValue="INSPECTION" name="category">
                  <option value="INSPECTION">Kontrolle</option>
                  <option value="MAINTENANCE">Wartung</option>
                  <option value="DAMAGE">Schaden</option>
                  <option value="SMOKE_DETECTOR">Rauchmelder</option>
                  <option value="HEATING">Heizung</option>
                  <option value="OTHER">Sonstiges</option>
                </select>
              </label>
              <label className="wide">
                <span>Items (eine Zeile pro Punkt)</span>
                <textarea
                  name="items"
                  placeholder={"Sichtpruefung Fluchtwege\nBeleuchtung geprueft\nBeschaedigungen dokumentiert"}
                  rows={6}
                  required
                />
              </label>
              <button disabled={createTemplateMutation.isPending} type="submit">
                Template speichern
              </button>
            </form>
          </article>
        </section>
      ) : null}

      <section className="grid-2">
        <article className="card">
          <h3>Aktive Wartungsplaene</h3>
          <div className="stack">
            {maintenancePlans.map((plan) => (
              <div className="list-card" key={plan.id}>
                <strong>{plan.title}</strong>
                <span className="muted">
                  {plan.property?.name ?? "-"} - {plan.category}
                </span>
                <div className="meta-row">
                  <span>Naechste Faelligkeit: {plan.nextDueDate.slice(0, 10)}</span>
                  <span>{plan.occurrences?.length ?? 0} Vorgaenge</span>
                </div>
              </div>
            ))}
            {maintenancePlans.length === 0 ? (
              <p className="muted">Noch keine Wartungsplaene vorhanden.</p>
            ) : null}
          </div>
        </article>

        <article className="card">
          <h3>Checklisten-Templates</h3>
          <div className="stack">
            {templates.map((template) => (
              <div className="list-card" key={template.id}>
                <strong>{template.name}</strong>
                <span className="muted">{template.categoryLabel}</span>
                <div className="meta-row">
                  <span>{template.items?.length ?? 0} Punkte</span>
                </div>
              </div>
            ))}
            {templates.length === 0 ? (
              <p className="muted">Noch keine Templates vorhanden.</p>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
