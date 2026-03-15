import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { apiClient } from "../api/client";
import { useAuth } from "../features/auth/auth-context";

type Mode = "login" | "register" | "forgot-password" | "reset-password" | "accept-invitation";

function resolveModeFromSearch(searchParams: URLSearchParams): Mode {
  const rawMode = searchParams.get("mode");
  if (
    rawMode === "register" ||
    rawMode === "forgot-password" ||
    rawMode === "reset-password" ||
    rawMode === "accept-invitation"
  ) {
    return rawMode;
  }

  return "login";
}

export function AuthPage() {
  const { login, registerOrganization, acceptInvitation } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => resolveModeFromSearch(searchParams));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialToken = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  function updateMode(nextMode: Mode) {
    setMode(nextMode);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("mode", nextMode);
    setSearchParams(nextSearchParams);
    setError(null);
    setSuccess(null);
  }

  async function handleLoginSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await login({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? "")
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login fehlgeschlagen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegisterSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await registerOrganization({
        organizationName: String(formData.get("organizationName") ?? ""),
        contactEmail: String(formData.get("contactEmail") ?? ""),
        adminName: String(formData.get("adminName") ?? ""),
        password: String(formData.get("password") ?? "")
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Registrierung fehlgeschlagen."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordResetRequest(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await apiClient.requestPasswordReset(String(formData.get("email") ?? ""));
      setSuccess(
        result.previewToken
          ? `Reset angefordert. Dev-Token: ${result.previewToken}`
          : "Falls die E-Mail existiert, wurde ein Reset ausgelost."
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Passwort-Reset konnte nicht angefordert werden."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordResetConfirm(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.confirmPasswordReset(
        String(formData.get("token") ?? ""),
        String(formData.get("password") ?? "")
      );
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set("mode", "login");
      setSearchParams(nextSearchParams);
      setMode("login");
      setSuccess("Passwort erfolgreich aktualisiert. Bitte jetzt anmelden.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Passwort konnte nicht aktualisiert werden."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAcceptInvitation(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await acceptInvitation({
        token: String(formData.get("token") ?? ""),
        name: String(formData.get("name") ?? ""),
        password: String(formData.get("password") ?? "")
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Einladung konnte nicht angenommen werden."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="stack">
          <p className="eyebrow">Mandantenfaehige SaaS fuer Eigentuemer und Hausmeister</p>
          <h1>Hauswartungs-Manager</h1>
          <p className="muted">
            Dokumentation, Wartung, Tickets und Nachweise in einer klaren Web-Oberflaeche.
          </p>
        </div>

        <div className="segmented-control wrap">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => updateMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => updateMode("register")}
            type="button"
          >
            Organisation anlegen
          </button>
          <button
            className={mode === "forgot-password" ? "active" : ""}
            onClick={() => updateMode("forgot-password")}
            type="button"
          >
            Passwort-Reset
          </button>
          <button
            className={mode === "accept-invitation" ? "active" : ""}
            onClick={() => updateMode("accept-invitation")}
            type="button"
          >
            Einladung annehmen
          </button>
        </div>

        {error ? <div className="alert error">{error}</div> : null}
        {success ? <div className="alert success">{success}</div> : null}

        {mode === "login" ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLoginSubmit(new FormData(event.currentTarget));
            }}
          >
            <label>
              <span>E-Mail</span>
              <input name="email" type="email" placeholder="admin@verwaltung.de" required />
            </label>
            <label>
              <span>Passwort</span>
              <input name="password" type="password" required />
            </label>
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Wird angemeldet..." : "Anmelden"}
            </button>
          </form>
        ) : null}

        {mode === "register" ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void handleRegisterSubmit(new FormData(event.currentTarget));
            }}
          >
            <label>
              <span>Organisationsname</span>
              <input name="organizationName" placeholder="Beispiel Verwaltung GmbH" required />
            </label>
            <label>
              <span>Kontakt-E-Mail</span>
              <input name="contactEmail" type="email" placeholder="kontakt@verwaltung.de" required />
            </label>
            <label>
              <span>Admin-Name</span>
              <input name="adminName" placeholder="Max Mustermann" required />
            </label>
            <label>
              <span>Passwort</span>
              <input name="password" type="password" required />
            </label>
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Wird angelegt..." : "Organisation erstellen"}
            </button>
          </form>
        ) : null}

        {mode === "forgot-password" ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void handlePasswordResetRequest(new FormData(event.currentTarget));
            }}
          >
            <label>
              <span>E-Mail</span>
              <input name="email" type="email" placeholder="benutzer@verwaltung.de" required />
            </label>
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Wird angefordert..." : "Reset-Link anfordern"}
            </button>
            <button onClick={() => updateMode("reset-password")} type="button">
              Ich habe bereits einen Token
            </button>
          </form>
        ) : null}

        {mode === "reset-password" ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void handlePasswordResetConfirm(new FormData(event.currentTarget));
            }}
          >
            <label>
              <span>Reset-Token</span>
              <input defaultValue={initialToken} name="token" required />
            </label>
            <label>
              <span>Neues Passwort</span>
              <input name="password" type="password" required />
            </label>
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Wird gespeichert..." : "Passwort zuruecksetzen"}
            </button>
          </form>
        ) : null}

        {mode === "accept-invitation" ? (
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAcceptInvitation(new FormData(event.currentTarget));
            }}
          >
            <label>
              <span>Einladungs-Token</span>
              <input defaultValue={initialToken} name="token" required />
            </label>
            <label>
              <span>Name</span>
              <input name="name" placeholder="Vor- und Nachname" required />
            </label>
            <label>
              <span>Passwort</span>
              <input name="password" type="password" required />
            </label>
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Wird verarbeitet..." : "Einladung annehmen"}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
