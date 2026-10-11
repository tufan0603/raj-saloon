'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Settings } from './types';

const CACHE_KEY = 'saloonease_settings';

const DEFAULTS: Settings = {
  salonName: process.env.NEXT_PUBLIC_APP_NAME || 'SaloonEase',
  tagline: 'Fast salon queue & slot booking',
  about: '',
  phone: '',
  whatsapp: '',
  address: '',
  mapUrl: '',
  announcement: '',
  announcementActive: false,
  gallery: [],
  openTime: '10:00',
  closeTime: '20:00',
  slotInterval: 15,
  weeklyOff: [],
  maxAdvanceDays: 7,
  tokenStart: 101,
  allowOnlineBooking: true,
  maxActiveBookingsPerUser: 2,
  timezone: 'Asia/Kolkata',
  currency: 'INR',
};

interface Ctx {
  settings: Settings;
  loaded: boolean;
  refresh: () => Promise<void>;
}
const SettingsContext = createContext<Ctx>({ settings: DEFAULTS, loaded: false, refresh: async () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ settings: Settings }>('/settings');
      setSettings(res.settings);
      setLoaded(true);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(res.settings));
      } catch {}
    } catch {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) setSettings({ ...DEFAULTS, ...JSON.parse(cached) });
    } catch {}
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ settings, loaded, refresh }), [settings, loaded, refresh]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
