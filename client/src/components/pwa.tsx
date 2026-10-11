'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Download, Share, WifiOff, RefreshCw, CalendarCheck, Timer, Zap, BellRing, PlusSquare, X } from 'lucide-react';
import { useInstallPrompt, useOnline } from '@/lib/hooks';
import { useSettings } from '@/lib/settings-context';
import { BrandLogo } from './brand';
import { Button } from './ui';

const DISMISS_KEY = 'saloonease_install_dismissed';
const AUTO_DELAY_MS = 4000;

/** Open the install sheet from anywhere: window.dispatchEvent(new Event('saloonease:install')) */
export const openInstallSheet = () => window.dispatchEvent(new Event('saloonease:install'));

export function PWAProvider({ children }: { children: ReactNode }) {
  const online = useOnline();
  const { settings } = useSettings();
  const { canInstall, install, installed, isIOS } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [busy, setBusy] = useState(false);

  // register service worker + detect updates
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
      // Reload only when an *updated* worker replaces the one already controlling this page.
      // On a first visit the new worker claims the page too, and reloading then would be a pointless flash.
      const hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
  }, []);

  // auto-open once per 3 days when installable (Android/desktop) or on iOS Safari
  useEffect(() => {
    if (installed) return;
    let dismissedRecently = false;
    try {
      const d = localStorage.getItem(DISMISS_KEY);
      dismissedRecently = Boolean(d && Date.now() - Number(d) < 3 * 24 * 3600 * 1000);
    } catch {}
    const onManual = () => setOpen(true);
    window.addEventListener('saloonease:install', onManual);
    let t: ReturnType<typeof setTimeout> | null = null;
    if (!dismissedRecently && (canInstall || isIOS)) t = setTimeout(() => setOpen(true), AUTO_DELAY_MS);
    return () => {
      window.removeEventListener('saloonease:install', onManual);
      if (t) clearTimeout(t);
    };
  }, [canInstall, isIOS, installed]);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };
  const doInstall = async () => {
    setBusy(true);
    try {
      const ok = await install();
      if (ok) setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const perks = [
    { icon: CalendarCheck, title: 'Book in seconds', text: 'One tap from your home screen, no browser needed' },
    { icon: Timer, title: 'Live turn tracking', text: 'See who is in the chair and when you are next' },
    { icon: Zap, title: 'Opens instantly', text: 'Full screen, fast, works on slow networks' },
    { icon: BellRing, title: 'Stay updated', text: 'Barbers get instant alerts for new bookings' },
  ];

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
          <button onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-xl">
            <RefreshCw className="h-4 w-4" /> Update available. Tap to refresh
          </button>
        </div>
      )}

      {open && !installed && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 backdrop-blur-[2px] animate-fadein sm:items-center sm:p-4" onClick={dismiss}>
          <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slideup sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="h-28 bg-gradient-to-br from-brand-600 to-teal-700" />
            <button onClick={dismiss} aria-label="Close" className="absolute right-3 top-3 rounded-full bg-white/20 p-1.5 text-white backdrop-blur">
              <X className="h-5 w-5" />
            </button>
            <div className="-mt-14 flex flex-col items-center px-6 text-center">
              <div className="rounded-full bg-white p-1.5 shadow-lg">
                <BrandLogo size={96} />
              </div>
              <h2 className="mt-3 text-2xl font-black leading-tight text-slate-900">Install {settings.salonName}</h2>
              <p className="mt-1 text-sm text-slate-500">Add the app to your home screen. It is free, takes 2 seconds and uses almost no storage.</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 px-5">
              {perks.map((p) => (
                <div key={p.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p.icon className="h-5 w-5 text-brand-600" />
                  <p className="mt-1.5 text-xs font-bold text-slate-900">{p.title}</p>
                  <p className="text-[11px] leading-snug text-slate-500">{p.text}</p>
                </div>
              ))}
            </div>

            <div className="px-5 pt-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
              {canInstall ? (
                <Button className="w-full py-3.5 text-base" loading={busy} onClick={doInstall}>
                  <Download className="h-5 w-5" /> Install app
                </Button>
              ) : isIOS ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">On iPhone / iPad</p>
                  <ol className="mt-2 space-y-2 text-sm text-slate-700">
                    <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">1</span> Tap the <Share className="inline h-4 w-4 text-sky-600" /> <b>Share</b> button in Safari</li>
                    <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">2</span> Choose <PlusSquare className="inline h-4 w-4" /> <b>Add to Home Screen</b></li>
                    <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">3</span> Tap <b>Add</b> in the top right</li>
                  </ol>
                </div>
              ) : (
                <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">Open this site in Chrome on your phone and tap <b>Install app</b> from the browser menu.</p>
              )}
              <button onClick={dismiss} className="mt-2 w-full py-2.5 text-sm font-semibold text-slate-400">
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
