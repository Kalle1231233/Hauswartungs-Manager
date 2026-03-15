import { useMemo, useState } from "react";

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
  notes?: string;
  units?: Array<{ id: string; label?: string; floor?: string | null }>;
  contacts?: Array<{
    id: string;
    name?: string;
    company?: string | null;
    roleLabel?: string;
    phone?: string | null;
    email?: string | null;
  }>;
  documents?: Array<{
    id: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    createdAt?: string;
  }>;
};

export function PropertiesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = session?.user.role === "ORG_ADMIN" || session?.user.role === "SUPER_ADMIN";
  const canUploadDocuments =
    session?.user.role === "ORG_ADMIN" ||
    session?.user.role === "SUPER_ADMIN" ||
    session?.user.role === "TECHNICIAN";
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "VILLA" | "MULTI_FAMILY" | "OTHER">("ALL");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

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

  const uploadDocumentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new Error("Bitte eine Datei auswaehlen.");
      }

      if (!selectedPropertyId) {
        throw new Error("Bitte zuerst ein Objekt auswaehlen.");
      }

      return apiClient.uploadPropertyDocument(session!, selectedPropertyId, file);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
    }
  });

  const properties = (propertiesQuery.data ?? []) as PropertyRecord[];
  const filteredProperties = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return properties.filter((property) => {
      const matchesType = typeFilter === "ALL" || property.type === typeFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        `${property.name} ${property.street} ${property.city} ${property.postalCode}`
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesType && matchesSearch;
    });
  }, [properties, search, typeFilter]);

  const selectedProperty =
    filteredProperties.find((property) => property.id === selectedPropertyId) ??
    filteredProperties[0] ??
    null;

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
        <div className="toolbar">
          <label className="toolbar-field">
            <span>Suche</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, Adresse oder Ort"
              value={search}
            />
          </label>
          <label className="toolbar-field">
            <span>Typ</span>
            <select
              onChange={(event) =>
                setTypeFilter(event.target.value as "ALL" | "VILLA" | "MULTI_FAMILY" | "OTHER")
              }
              value={typeFilter}
            >
              <option value="ALL">Alle</option>
              <option value="VILLA">Villa</option>
              <option value="MULTI_FAMILY">Mehrfamilienhaus</option>
              <option value="OTHER">Sonstiges</option>
            </select>
          </label>
        </div>

        {propertiesQuery.isLoading ? <p>Lade Objekte...</p> : null}
        {propertiesQuery.isError ? (
          <p className="alert error">{propertiesQuery.error.message}</p>
        ) : null}
        <div className="list-grid">
          {filteredProperties.map((property) => (
            <button
              className={`list-card selectable-card ${selectedProperty?.id === property.id ? "selected-card" : ""}`}
              key={property.id}
              onClick={() => setSelectedPropertyId(property.id)}
              type="button"
            >
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
                <span>{property.documents?.length ?? 0} Dokumente</span>
              </div>
            </button>
          ))}
          {!propertiesQuery.isLoading && filteredProperties.length === 0 ? (
            <p className="muted">Keine Objekte fuer die aktuelle Filterung gefunden.</p>
          ) : null}
        </div>
      </section>

      {selectedProperty ? (
        <section className="grid-2">
          <article className="card">
            <h3>Objektdetail</h3>
            <div className="stack">
              <div>
                <strong>{selectedProperty.name}</strong>
                <p className="muted">
                  {selectedProperty.street}, {selectedProperty.postalCode} {selectedProperty.city}
                </p>
                {selectedProperty.notes ? <p>{selectedProperty.notes}</p> : null}
              </div>

              <div className="detail-section">
                <h4>Einheiten</h4>
                {selectedProperty.units?.length ? (
                  selectedProperty.units.map((unit) => (
                    <div className="list-item" key={unit.id}>
                      <strong>{unit.label ?? "Einheit"}</strong>
                      <span className="muted">{unit.floor ?? "Kein Geschoss hinterlegt"}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">Keine Einheiten hinterlegt.</p>
                )}
              </div>

              <div className="detail-section">
                <h4>Ansprechpartner</h4>
                {selectedProperty.contacts?.length ? (
                  selectedProperty.contacts.map((contact) => (
                    <div className="list-item" key={contact.id}>
                      <strong>{contact.name ?? "Kontakt"}</strong>
                      <span className="muted">
                        {contact.roleLabel ?? "-"}
                        {contact.company ? ` - ${contact.company}` : ""}
                      </span>
                      <span className="muted">
                        {contact.email ?? ""}
                        {contact.email && contact.phone ? " | " : ""}
                        {contact.phone ?? ""}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="muted">Keine Kontakte hinterlegt.</p>
                )}
              </div>
            </div>
          </article>

          <article className="card">
            <h3>Dokumente und Nachweise</h3>
            {canUploadDocuments ? (
              <form
                className="form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  void uploadDocumentMutation.mutateAsync(new FormData(event.currentTarget)).then(() => {
                    event.currentTarget.reset();
                  });
                }}
              >
                <label>
                  <span>Datei hochladen</span>
                  <input accept=".pdf,image/*" name="file" required type="file" />
                </label>
                <button disabled={uploadDocumentMutation.isPending} type="submit">
                  {uploadDocumentMutation.isPending ? "Laedt hoch..." : "Dokument hochladen"}
                </button>
              </form>
            ) : null}

            <div className="stack">
              {selectedProperty.documents?.map((document) => (
                <a
                  className="list-item link-card"
                  href={document.filePath}
                  key={document.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <strong>{document.fileName ?? "Dokument"}</strong>
                  <span className="muted">{document.mimeType ?? "-"}</span>
                  <span className="muted">
                    {document.createdAt ? document.createdAt.slice(0, 10) : "Unbekanntes Datum"}
                  </span>
                </a>
              ))}
              {!selectedProperty.documents?.length ? (
                <p className="muted">Noch keine Dokumente hinterlegt.</p>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}
