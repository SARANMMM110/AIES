"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PublicUser } from "@aes/shared";
import { apiFetch, setToken } from "@/lib/api";

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<PublicUser>;
  /** Apply tokens returned from guest checkout / purchase */
  applySession: (accessToken: string, user: PublicUser) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: PublicUser }>("/api/auth/me", {
        signal: AbortSignal.timeout(12000),
      });
      setUser(data.user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== "undefined" ? localStorage.getItem("aes_token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{
      user: PublicUser;
      tokens: { accessToken: string };
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.tokens.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => {
      const data = await apiFetch<{
        user: PublicUser;
        tokens: { accessToken: string };
      }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setToken(data.tokens.accessToken);
      setUser(data.user);
      return data.user;
    },
    []
  );

  const applySession = useCallback((accessToken: string, nextUser: PublicUser) => {
    setToken(accessToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors on logout
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, applySession, logout, refresh }),
    [user, loading, login, register, applySession, logout, refresh]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
