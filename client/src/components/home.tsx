'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import type { Media } from '@/lib/types';
import { cn } from '@/lib/utils';

export function SectionHead({ eyebrow, title, action, className }: { eyebrow: string; title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-end justify-between px-4', className)}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
        <h2 className="mt-0.5 text-xl font-black leading-tight tracking-tight text-slate-900">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function MediaThumb({ m, className, onClick, caption = true, sizes }: { m: Media; className?: string; onClick?: () => void; caption?: boolean; sizes?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('group relative block overflow-hidden rounded-2xl bg-slate-200 text-left', className)}>
      {m.resourceType === 'video' ? (
        <>
          <video src={m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow"><Play className="ml-0.5 h-5 w-5" /></span>
          </span>
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.url} alt={m.caption || ''} loading="lazy" sizes={sizes} className="h-full w-full object-cover transition duration-500 group-active:scale-105" />
      )}
      {caption && m.caption && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-[11px] font-semibold text-white">{m.caption}</span>
      )}
    </button>
  );
}

/** Full-screen media viewer with swipe-free prev/next controls. */
export function Lightbox({ items, index, onClose, onIndex }: { items: Media[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const open = index !== null && items[index];
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex(Math.min(items.length - 1, (index as number) + 1));
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, (index as number) - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, index, items.length, onClose, onIndex]);
  if (!open) return null;
  const m = items[index as number];
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95 animate-fadein" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
        <span className="text-xs font-semibold text-white/70">{(index as number) + 1} / {items.length}</span>
        <button onClick={onClose} aria-label="Close" className="rounded-full bg-white/10 p-2"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex flex-1 items-center justify-center px-2" onClick={(e) => e.stopPropagation()}>
        {m.resourceType === 'video' ? (
          <video src={m.url} controls autoPlay playsInline className="max-h-[75dvh] w-full rounded-xl" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt={m.caption || ''} className="max-h-[75dvh] w-full rounded-xl object-contain" />
        )}
      </div>
      <div className="flex items-center justify-between px-4 pb-6 text-white" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }} onClick={(e) => e.stopPropagation()}>
        <button disabled={index === 0} onClick={() => onIndex((index as number) - 1)} className="rounded-full bg-white/10 p-3 disabled:opacity-30" aria-label="Previous"><ChevronLeft className="h-5 w-5" /></button>
        <p className="mx-3 flex-1 text-center text-sm font-semibold">{m.caption}</p>
        <button disabled={index === items.length - 1} onClick={() => onIndex((index as number) + 1)} className="rounded-full bg-white/10 p-3 disabled:opacity-30" aria-label="Next"><ChevronRight className="h-5 w-5" /></button>
      </div>
    </div>
  );
}

/** Horizontal, snap-scrolling strip with page gutters. */
export function Strip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1', className)}>{children}</div>;
}

export function useOpenNow(openTime: string, closeTime: string, weeklyOff: number[]) {
  const [state, setState] = useState<{ open: boolean; label: string }>({ open: true, label: '' });
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const [oh, om] = openTime.split(':').map(Number);
      const [ch, cm] = closeTime.split(':').map(Number);
      const o = oh * 60 + om;
      const c = ch * 60 + cm;
      const off = weeklyOff.includes(now.getDay());
      const fmt = (h: number, m: number) => `${h % 12 === 0 ? 12 : h % 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`;
      if (off) return setState({ open: false, label: 'Closed today' });
      if (mins < o) return setState({ open: false, label: `Opens ${fmt(oh, om)}` });
      if (mins >= c) return setState({ open: false, label: `Closed • opens ${fmt(oh, om)}` });
      setState({ open: true, label: `Open • till ${fmt(ch, cm)}` });
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [openTime, closeTime, weeklyOff]);
  return state;
}
