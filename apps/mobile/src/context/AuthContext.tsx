import React, { createContext, useContext, useEffect, useState } from "react";
import { api, clearSession, getStoredAccessToken, saveSession } from "../api/client";

interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getStoredAccessToken();
      if (token) {
        try {
          const me = await api.get<AuthUser>("/auth/me");
          setUser(me);
        } catch {
          await clearSession();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const result = await api.post<{ user: AuthUser; accessToken: string; refreshToken: string }>(
      "/auth/login",
      { email, password },
    );
    await saveSession(result.accessToken, result.refreshToken);
    setUser(result.user);
  }

  async function register(fullName: string, email: string, password: string) {
    const result = await api.post<{ user: AuthUser; accessToken: string; refreshToken: string }>(
      "/auth/register",
      { fullName, email, password },
    );
    await saveSession(result.accessToken, result.refreshToken);
    setUser(result.user);
  }

  async function logout() {
    await clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return ctx;
}
