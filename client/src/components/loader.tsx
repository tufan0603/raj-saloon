'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Thin progress bar at the very top while API requests are in flight or a page is changing,
 * plus a "server is waking up" pill when a request takes longer than a few seconds
 * (free hosting tiers put the API to sleep when idle).
 */
export function TopLoader() {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const [slow, setSlow] = useState(false);
  const slowSince = useRef<number | null>(null);

  useEffect(() => {
    const onReq = (e: Event) => {
      const { phase } = (e as CustomEvent).detail || {};
      setPending((n) => {
        const next = Math.max(0, n + (phase === 'start' ? 1 : -1));
        if (next === 0) {
          setSlow(false);
          slowSince.current = null;
        }
        return next;
      });
    };
    const onSlow = () => {
      slowSince.current = slowSince.current || Date.now();
      setSlow(true);
    };
    window.addEventListener('saloonease:request', onReq);
    window.addEventListener('saloonease:slow', onSlow);
    // start the bar as soon as an in-app link is tapped; it ends when the pathname changes
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.('a[href^="/"]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey) return;
      if (a.getAttribute('href') !== window.location.pathname + window.location.search) setNavigating(true);
    };
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('saloonease:request', onReq);
      window.removeEventListener('saloonease:slow', onSlow);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  const active = pending > 0 || navigating;
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[3px]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className={`h-full origin-left bg-gradient-to-r from-brand-500 via-brand-400 to-teal-400 transition-all duration-500 ${active ? 'w-[85%] opacity-100' : 'w-full opacity-0'}`} style={{ transitionTimingFunction: active ? 'cubic-bezier(0.1, 0.8, 0.3, 1)' : 'ease', transitionDuration: active ? '6s' : '300ms' }} />
      </div>
      {slow && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[110] flex justify-center px-4" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-lg backdrop-blur animate-fadein">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" /> Waking up the server, this can take up to a minute the first time...
          </div>
        </div>
      )}
    </>
  );
}
