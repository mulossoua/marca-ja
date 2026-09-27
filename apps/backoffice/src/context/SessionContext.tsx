import React, { createContext, useContext, useEffect, useState } from "react";
import { clearSession, hasSession, saveSession } from "../api/client";
import { listMyBusinesses, login as apiLogin, type Branch, type Business } from "../api/domain";

interface SessionContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  businesses: Business[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  reloadBusinesses: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(hasSession());
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);

  async function reloadBusinesses() {
    const list = await listMyBusinesses();
    setBusinesses(list);
    if (!currentBranch && list[0]?.branches[0]) {
      setCurrentBranch(list[0].branches[0]);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    reloadBusinesses().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function login(email: string, password: string) {
    const result = await apiLogin(email, password);
    saveSession(result.accessToken, result.refreshToken);
    setIsAuthenticated(true);
  }

  function logout() {
    clearSession();
    setIsAuthenticated(false);
    setBusinesses([]);
    setCurrentBranch(null);
  }

  return (
    <SessionContext.Provider
      value={{ isAuthenticated, loading, businesses, currentBranch, setCurrentBranch, login, logout, reloadBusinesses }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession deve ser usado dentro de SessionProvider.");
  return ctx;
}
