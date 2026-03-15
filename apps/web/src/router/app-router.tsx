import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "../components/layout";
import { useAuth } from "../features/auth/auth-context";
import { AuthPage } from "../pages/auth-page";
import { DashboardPage } from "../pages/dashboard-page";
import { MaintenancePage } from "../pages/maintenance-page";
import { OrganizationPage } from "../pages/organization-page";
import { PropertiesPage } from "../pages/properties-page";
import { TicketsPage } from "../pages/tickets-page";

function ProtectedRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route element={<DashboardPage />} path="/" />
        <Route element={<PropertiesPage />} path="/properties" />
        <Route element={<TicketsPage />} path="/tickets" />
        <Route element={<MaintenancePage />} path="/maintenance" />
        <Route element={<OrganizationPage />} path="/organization" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </AppLayout>
  );
}

export function AppRouter() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <ProtectedRoutes /> : <AuthPage />;
}
