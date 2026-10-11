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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api<{ user: User }>('/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onLogout = () => setUser(null);
    window.addEventListener('saloonease:logout', onLogout);
    return () => window.removeEventListener('saloonease:logout', onLogout);
  }, [refresh]);

  const applyAuth = useCallback((payload: { token: string; user: User }) => {
    setToken(payload.token);
    setUser(payload.user);
  }, []);

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
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, isAdmin: user?.role === 'admin', login, register, logout, refresh, setUser, applyAuth }),
    [user, loading, login, register, logout, refresh, applyAuth],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
