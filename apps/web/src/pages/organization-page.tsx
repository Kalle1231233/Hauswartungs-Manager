import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { useAuth } from "../features/auth/auth-context";

type OrganizationUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

type InvitationRecord = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  invitedBy: { id: string; name: string };
};

export function OrganizationPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [invitePreview, setInvitePreview] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const canManageOrganization =
    session?.user.role === "ORG_ADMIN" || session?.user.role === "SUPER_ADMIN";

  const usersQuery = useQuery({
    queryKey: ["organization-users"],
    queryFn: () => apiClient.listUsers(session!),
    enabled: Boolean(session && canManageOrganization)
  });

  const invitationsQuery = useQuery({
    queryKey: ["organization-invitations"],
    queryFn: () => apiClient.listInvitations(session!),
    enabled: Boolean(session && canManageOrganization)
  });

  const inviteMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.createInvitation(session!, {
        email: String(formData.get("email") ?? ""),
        role: String(formData.get("role") ?? "TECHNICIAN") as
          | "ORG_ADMIN"
          | "TECHNICIAN"
          | "RESIDENT"
          | "SERVICE_PROVIDER"
      }),
    onSuccess: async (result) => {
      setInvitePreview(result.previewToken ?? null);
      setInviteError(null);
      await queryClient.invalidateQueries({ queryKey: ["organization-invitations"] });
    },
    onError: (error) => {
      setInviteError(error instanceof Error ? error.message : "Einladung fehlgeschlagen.");
      setInvitePreview(null);
    }
  });

  const toggleUserMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      apiClient.updateUserActiveState(session!, userId, isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization-users"] });
    }
  });

  const users = (usersQuery.data ?? []) as OrganizationUser[];
  const invitations = (invitationsQuery.data ?? []) as InvitationRecord[];

  if (!canManageOrganization) {
    return (
      <section className="card">
        <h3>Keine Berechtigung</h3>
        <p className="muted">
          Nur Organisations-Administratoren duerfen Nutzer und Einladungen verwalten.
        </p>
      </section>
    );
  }

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Organisation und Team</p>
          <h2>Nutzer, Rollen und Einladungen verwalten</h2>
        </div>
      </section>

      <section className="grid-2">
        <article className="card">
          <h3>Nutzer einladen</h3>
          <form
            className="form-grid compact-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void inviteMutation.mutateAsync(new FormData(event.currentTarget)).then(() => {
                event.currentTarget.reset();
              });
            }}
          >
            <label className="wide">
              <span>E-Mail</span>
              <input name="email" type="email" placeholder="technik@firma.de" required />
            </label>
            <label>
              <span>Rolle</span>
              <select defaultValue="TECHNICIAN" name="role">
                <option value="ORG_ADMIN">OrgAdmin</option>
                <option value="TECHNICIAN">Hausmeister / Techniker</option>
                <option value="RESIDENT">Bewohner / Mieter</option>
                <option value="SERVICE_PROVIDER">Externer Dienstleister</option>
              </select>
            </label>
            <button disabled={inviteMutation.isPending} type="submit">
              {inviteMutation.isPending ? "Einladung wird erstellt..." : "Einladung erstellen"}
            </button>
          </form>

          {inviteError ? <div className="alert error">{inviteError}</div> : null}
          {invitePreview ? (
            <div className="alert success stack">
              <strong>Dev-Vorschau fuer Einladung</strong>
              <code className="code-block">{invitePreview}</code>
              <span className="muted">
                Link-Beispiel: {window.location.origin}/?mode=accept-invitation&token={invitePreview}
              </span>
            </div>
          ) : null}
        </article>

        <article className="card">
          <h3>Offene Einladungen</h3>
          <div className="stack">
            {invitations.map((invitation) => (
              <div className="list-card" key={invitation.id}>
                <strong>{invitation.email}</strong>
                <span className="muted">
                  {invitation.role} - eingeladen von {invitation.invitedBy.name}
                </span>
                <div className="meta-row">
                  <span>Erstellt: {invitation.createdAt.slice(0, 10)}</span>
                  <span>Gueltig bis: {invitation.expiresAt.slice(0, 10)}</span>
                </div>
              </div>
            ))}
            {!invitations.length ? (
              <p className="muted">Derzeit gibt es keine offenen Einladungen.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="card">
        <h3>Nutzer und Aktivstatus</h3>
        <div className="stack">
          {users.map((user) => (
            <div className="list-card" key={user.id}>
              <div className="split-row">
                <div className="stack small-gap">
                  <strong>{user.name}</strong>
                  <span className="muted">
                    {user.email} - {user.role}
                  </span>
                </div>
                <div className="inline-actions">
                  <span className={`badge ${user.isActive ? "" : "subtle"}`}>
                    {user.isActive ? "Aktiv" : "Deaktiviert"}
                  </span>
                  <button
                    onClick={() =>
                      void toggleUserMutation.mutateAsync({
                        userId: user.id,
                        isActive: !user.isActive
                      })
                    }
                    type="button"
                  >
                    {user.isActive ? "Deaktivieren" : "Aktivieren"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!users.length ? <p className="muted">Noch keine Nutzer vorhanden.</p> : null}
        </div>
      </section>
    </div>
  );
}
