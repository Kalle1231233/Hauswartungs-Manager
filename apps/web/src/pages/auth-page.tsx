import { useState } from "react";

import { useAuth } from "../features/auth/auth-context";

type Mode = "login" | "register";

export function AuthPage() {
  const { login, registerOrganization } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLoginSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);

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

        <div className="segmented-control">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            Organisation anlegen
          </button>
        </div>

        {error ? <div className="alert error">{error}</div> : null}

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
        ) : (
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
        )}
      </section>
    </div>
  );
}
