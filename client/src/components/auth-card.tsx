'use client';
import Link from 'next/link';
import { useSettings } from '@/lib/settings-context';
import { BrandLogo } from './brand';
import type { ReactNode } from 'react';

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const { settings } = useSettings();
  return (
    <main className="safe-top mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8">
      <div className="flex flex-1 flex-col justify-center py-8">
        <Link href="/" className="mb-6 flex items-center gap-3">
          <BrandLogo size={56} />
          <span>
            <span className="block text-lg font-extrabold leading-none text-slate-900">{settings.salonName}</span>
            <span className="mt-1 block text-xs font-medium text-brand-600">{settings.tagline}</span>
          </span>
        </Link>
        <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="card mt-5">{children}</div>
        {footer && <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </main>
  );
}
