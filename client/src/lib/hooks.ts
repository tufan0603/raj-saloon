'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const CACHE_PREFIX = 'saloonease_cache:';

function readCache<T>(key?: string): T | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { v, t } = JSON.parse(raw);
    // cached data is only a first paint; it is refreshed immediately, so keep it for 24h at most
    return Date.now() - t < 24 * 3600 * 1000 ? (v as T) : null;
  } catch {
    return null;
  }
}
function writeCache(key: string | undefined, v: unknown) {
  if (!key) return;
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ v, t: Date.now() }));
  } catch {}
}

export interface LoaderOptions {
  /** When set, the last successful result is kept in localStorage and shown instantly on the next visit (stale-while-revalidate). */
  cacheKey?: string;
}

/** Poll an async loader on an interval; pauses when the tab is hidden. */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function usePolling<T>(loader: (() => Promise<T>) | null, intervalMs = 15000, deps: unknown[] = [], opts: LoaderOptions = {}) {
  // Start empty so server and client render the same HTML; the cached value is applied right after hydration,
  // before the first paint, so returning visitors still see content instantly.
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(loader));
  const hasCache = useRef(false);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useIsoLayoutEffect(() => {
    const c = readCache<T>(opts.cacheKey);
    if (c !== null) {
      hasCache.current = true;
      setData(c);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.cacheKey]);

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
        writeCache(opts.cacheKey, res);
      } catch (e: any) {
        if (active) setError(e?.message || 'Failed to load');
      } finally {
        if (active) setLoading(false);
        if (active && intervalMs > 0) timer = setTimeout(run, document.hidden ? intervalMs * 4 : intervalMs);
      }
    };
    if (!hasCache.current) setLoading(true);
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

  return { data, error, loading, refresh, setData, stale: data !== null && loading };
}

/** One-shot async loader with manual refresh. */
export function useAsync<T>(loader: (() => Promise<T>) | null, deps: unknown[] = [], opts: LoaderOptions = {}) {
  return usePolling<T>(loader, 0, deps, opts);
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
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream), []);
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
