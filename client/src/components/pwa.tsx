'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Download, Share, WifiOff, X, RefreshCw } from 'lucide-react';
import { useInstallPrompt, useOnline } from '@/lib/hooks';

const DISMISS_KEY = 'saloonease_install_dismissed';

export function PWAProvider({ children }: { children: ReactNode }) {
  const online = useOnline();
  const { canInstall, install, installed, isIOS } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    try {
      const d = localStorage.getItem(DISMISS_KEY);
      setDismissed(d ? Date.now() - Number(d) < 3 * 24 * 3600 * 1000 : false);
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            sw?.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(sw);
            });
          });
        })
        .catch((e) => console.warn('[sw] register failed', e));
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const showInstall = !installed && !dismissed && (canInstall || isIOS);

  return (
    <>
      {!online && (
        <div className="safe-top fixed inset-x-0 top-0 z-[90] bg-slate-900 text-center text-[11px] font-semibold text-white">
          <div className="flex items-center justify-center gap-1.5 py-1.5">
            <WifiOff className="h-3.5 w-3.5" /> You are offline. Showing last known data.
          </div>
        </div>
      )}
      {children}
      {waiting && (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-[calc(100%-2rem)] max-w-md">
          <button
            onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-xl"
          >
            <RefreshCw className="h-4 w-4" /> Update available. Tap to refresh
          </button>
        </div>
      )}
      {showInstall && (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-[calc(100%-2rem)] max-w-md animate-slideup">
          <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-white p-3 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-slate-900">Install SaloonEase</p>
              {isIOS && !canInstall ? (
                <p className="flex items-center gap-1 text-[11px] text-slate-500">
                  Tap <Share className="h-3 w-3" /> then &ldquo;Add to Home Screen&rdquo;
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">Faster access, full screen, works like an app.</p>
              )}
            </div>
            {canInstall && (
              <button onClick={install} className="btn-primary px-3 py-2 text-xs">
                <Download className="h-3.5 w-3.5" /> Install
              </button>
            )}
            <button onClick={dismiss} aria-label="Dismiss" className="p-1 text-slate-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
