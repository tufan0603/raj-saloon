'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Poll an async loader on an interval; pauses when the tab is hidden. */
export function usePolling<T>(loader: (() => Promise<T>) | null, intervalMs = 15000, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(loader));
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!loaderRef.current) {
      setLoading(false);
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      try {
        const res = await loaderRef.current!();
        if (!active) return;
        setData(res);
        setError(null);
      } catch (e: any) {
        if (active) setError(e?.message || 'Failed to load');
      } finally {
        if (active) setLoading(false);
        if (active && intervalMs > 0) timer = setTimeout(run, document.hidden ? intervalMs * 4 : intervalMs);
      }
    };
    setLoading(true);
    run();
    const onVisible = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        run();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, tick, ...deps]);

  return { data, error, loading, refresh, setData };
}

/** One-shot async loader with manual refresh. */
export function useAsync<T>(loader: (() => Promise<T>) | null, deps: unknown[] = []) {
  return usePolling<T>(loader, 0, deps);
}

/** Captures the browser "Add to Home Screen" prompt for a custom install button. */
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setInstalled(Boolean(standalone));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const install = useCallback(async () => {
    if (!prompt) return false;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
    return outcome === 'accepted';
  }, [prompt]);
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  return { canInstall: Boolean(prompt), install, installed, isIOS };
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}
