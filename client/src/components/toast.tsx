'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; message: string }
interface ToastApi { toast: (message: string, kind?: Kind) => void; success: (m: string) => void; error: (m: string) => void; info: (m: string) => void }

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (message: string, kind: Kind = 'info') => {
      const id = ++idRef.current;
      setItems((l) => [...l.slice(-2), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 4500 : 3000);
    },
    [dismiss],
  );
  const value = useMemo<ToastApi>(
    () => ({ toast, success: (m) => toast(m, 'success'), error: (m) => toast(m, 'error'), info: (m) => toast(m, 'info') }),
    [toast],
  );
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-lg animate-slideup backdrop-blur',
                t.kind === 'success' && 'border-brand-200 bg-brand-50/95 text-brand-800',
                t.kind === 'error' && 'border-red-200 bg-red-50/95 text-red-700',
                t.kind === 'info' && 'border-slate-200 bg-white/95 text-slate-800',
              )}
            >
              <I className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1 font-medium leading-snug">{t.message}</span>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 rounded p-0.5 opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
