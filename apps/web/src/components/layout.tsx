import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../features/auth/auth-context";

export function AppLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();

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
        </nav>

        <button className="ghost-button" onClick={() => void logout()}>
          Abmelden
        </button>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
