'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, clearToken, getToken, setToken } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; phone?: string; password: string }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
  applyAuth: (payload: { token: string; user: User }) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const USER_CACHE = 'saloonease_user';
const readCachedUser = (): User | null => {
  try {
    if (typeof window === 'undefined' || !getToken()) return null;
    const raw = localStorage.getItem(USER_CACHE);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // keep a copy of the profile so protected pages render immediately on the next launch (verified in background)
  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    try {
      if (u) localStorage.setItem(USER_CACHE, JSON.stringify(u));
      else localStorage.removeItem(USER_CACHE);
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    const cached = readCachedUser();
    if (cached) {
      setUserState(cached);
      setLoading(false);
    }
    try {
      const res = await api<{ user: User }>('/auth/me');
      setUser(res.user);
    } catch (e: any) {
      // only drop the session on a definite auth failure, not on a network hiccup / sleeping server
      if (e?.status === 401 || e?.status === 403 || !cached) setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    refresh();
    const onLogout = () => setUser(null);
    window.addEventListener('saloonease:logout', onLogout);
    return () => window.removeEventListener('saloonease:logout', onLogout);
  }, [refresh, setUser]);

  const applyAuth = useCallback(
    (payload: { token: string; user: User }) => {
      setToken(payload.token);
      setUser(payload.user);
    },
    [setUser],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ token: string; user: User }>('/auth/login', { body: { email, password } });
      applyAuth(res);
      return res.user;
    },
    [applyAuth],
  );

  const register = useCallback(
    async (data: { name: string; email: string; phone?: string; password: string }) => {
      const res = await api<{ token: string; user: User }>('/auth/register', { body: data });
      applyAuth(res);
      return res.user;
    },
    [applyAuth],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, [setUser]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, isAdmin: user?.role === 'admin', login, register, logout, refresh, setUser, applyAuth }),
    [user, loading, login, register, logout, refresh, applyAuth, setUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
