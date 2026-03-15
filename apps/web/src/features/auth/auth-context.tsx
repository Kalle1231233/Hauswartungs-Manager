import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import type { LoginInput, RegisterOrganizationInput } from "@haus/shared";

import { apiClient, type ClientSession } from "../../api/client";

type AuthContextValue = {
  session: ClientSession | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  registerOrganization: (input: RegisterOrganizationInput) => Promise<void>;
  acceptInvitation: (input: { token: string; name: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const STORAGE_KEY = "hauswartungs-manager.session";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<ClientSession | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSession(JSON.parse(stored) as ClientSession);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isAuthenticated: Boolean(session),
    async login(input) {
      const nextSession = await apiClient.login(input);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    },
    async registerOrganization(input) {
      const nextSession = await apiClient.registerOrganization(input);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    },
    async acceptInvitation(input) {
      const nextSession = await apiClient.acceptInvitation(
        input.token,
        input.name,
        input.password
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    },
    async logout() {
      if (session?.refreshToken) {
        try {
          await apiClient.logout(session.refreshToken);
        } catch {
          // Ignore logout transport errors and clear the local session anyway.
        }
      }

      localStorage.removeItem(STORAGE_KEY);
      setSession(null);
    }
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
