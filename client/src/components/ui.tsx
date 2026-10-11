'use client';
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2, X, ChevronDown } from 'lucide-react';
import { cn, initials } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'primary', loading, className, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const map: Record<Variant, string> = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger' };
  return (
    <button className={cn(map[variant], className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, className }: { label?: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input', className)} {...rest} />;
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('input min-h-[88px] resize-y', className)} {...rest} />;
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn('input appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2.5">
      <span className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
    </button>
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div className={cn('card', onClick && 'cursor-pointer active:bg-slate-50', className)} onClick={onClick}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, action, icon }: { title: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
        {icon}
        {title}
      </h3>
      {action}
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('chip', className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-10', className)}>
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} />;
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center py-10 text-center">
      {icon && <div className="mb-2 text-slate-300">{icon}</div>}
      <h4 className="text-sm font-bold text-slate-800">{title}</h4>
      {text && <p className="mt-1 max-w-[260px] text-xs text-slate-400">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, src, size = 'md', className }: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const s = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base', xl: 'h-20 w-20 text-xl' }[size];
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className={cn('shrink-0 rounded-full object-cover', s, className)} />
  ) : (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700', s, className)}>{initials(name) || '?'}</div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('flex rounded-xl bg-slate-100 p-1', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cn('flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition', value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] animate-fadein sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl animate-slideup sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
        {title && (
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-slate-100 px-5 py-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, title, text, confirmText = 'Confirm', danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; text?: string; confirmText?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      }
    >
      {text && <p className="text-sm text-slate-600">{text}</p>}
    </Sheet>
  );
}
