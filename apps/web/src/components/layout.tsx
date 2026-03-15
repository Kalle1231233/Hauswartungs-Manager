import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../features/auth/auth-context";

export function AppLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();
  const canManageOrganization =
    session?.user.role === "ORG_ADMIN" || session?.user.role === "SUPER_ADMIN";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Hauswartungs-Manager</p>
          <h1>Portal</h1>
          <p className="muted">
            {session?.user.name}
            <br />
            {session?.user.role}
          </p>
        </div>

        <nav className="nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/properties">Objekte</NavLink>
          <NavLink to="/tickets">Tickets</NavLink>
          <NavLink to="/maintenance">Wartung</NavLink>
          {canManageOrganization ? <NavLink to="/organization">Organisation</NavLink> : null}
        </nav>

        <button className="ghost-button" onClick={() => void logout()}>
          Abmelden
        </button>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
