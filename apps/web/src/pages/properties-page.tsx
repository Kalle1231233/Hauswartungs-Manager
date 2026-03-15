import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { useAuth } from "../features/auth/auth-context";

type PropertyRecord = {
  id: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  type: string;
  units?: Array<{ id: string }>;
  contacts?: Array<{ id: string }>;
};

export function PropertiesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = session?.user.role === "ORG_ADMIN" || session?.user.role === "SUPER_ADMIN";

  const propertiesQuery = useQuery({
    queryKey: ["properties"],
    queryFn: () => apiClient.listProperties(session!),
    enabled: Boolean(session)
  });

  const createMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.createProperty(session!, {
        name: String(formData.get("name") ?? ""),
        street: String(formData.get("street") ?? ""),
        postalCode: String(formData.get("postalCode") ?? ""),
        city: String(formData.get("city") ?? ""),
        country: String(formData.get("country") ?? "DE"),
        type: String(formData.get("type") ?? "MULTI_FAMILY") as "VILLA" | "MULTI_FAMILY" | "OTHER",
        yearBuilt: formData.get("yearBuilt")
          ? Number(formData.get("yearBuilt"))
          : undefined,
        notes: String(formData.get("notes") ?? "") || undefined
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
    }
  });

  const properties = (propertiesQuery.data ?? []) as PropertyRecord[];

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Objektverwaltung</p>
          <h2>Immobilien, Einheiten und Ansprechpartner</h2>
        </div>
      </section>

      {isAdmin ? (
        <section className="card">
          <h3>Neues Objekt anlegen</h3>
          <form
            className="form-grid compact-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void createMutation.mutateAsync(new FormData(event.currentTarget)).then(() => {
                event.currentTarget.reset();
              });
            }}
          >
            <label>
              <span>Name</span>
              <input name="name" placeholder="Villa Sonnenhang" required />
            </label>
            <label>
              <span>Typ</span>
              <select name="type" defaultValue="MULTI_FAMILY">
                <option value="VILLA">Villa</option>
                <option value="MULTI_FAMILY">Mehrfamilienhaus</option>
                <option value="OTHER">Sonstiges</option>
              </select>
            </label>
            <label>
              <span>Strasse</span>
              <input name="street" required />
            </label>
            <label>
              <span>PLZ</span>
              <input name="postalCode" required />
            </label>
            <label>
              <span>Ort</span>
              <input name="city" required />
            </label>
            <label>
              <span>Land</span>
              <input defaultValue="DE" name="country" required />
            </label>
            <label>
              <span>Baujahr</span>
              <input name="yearBuilt" type="number" />
            </label>
            <label className="wide">
              <span>Notizen</span>
              <textarea name="notes" rows={3} />
            </label>
            <button disabled={createMutation.isPending} type="submit">
              {createMutation.isPending ? "Speichert..." : "Objekt speichern"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="card">
        <h3>Objektliste</h3>
        {propertiesQuery.isLoading ? <p>Lade Objekte...</p> : null}
        {propertiesQuery.isError ? (
          <p className="alert error">{propertiesQuery.error.message}</p>
        ) : null}
        <div className="list-grid">
          {properties.map((property) => (
            <article className="list-card" key={property.id}>
              <div className="stack">
                <strong>{property.name}</strong>
                <span className="muted">
                  {property.street}, {property.postalCode} {property.city}
                </span>
                <span className="badge">{property.type}</span>
              </div>
              <div className="meta-row">
                <span>{property.units?.length ?? 0} Einheiten</span>
                <span>{property.contacts?.length ?? 0} Kontakte</span>
              </div>
            </article>
          ))}
          {!propertiesQuery.isLoading && properties.length === 0 ? (
            <p className="muted">Noch keine Objekte vorhanden.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
