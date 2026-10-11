'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, CalendarPlus, ListOrdered, UserRound, LayoutDashboard, CalendarDays, Wallet, Menu, ChevronLeft, ShieldCheck, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { Spinner } from './ui';
import { BrandLogo } from './brand';

type NavKind = 'user' | 'admin' | 'none';

const USER_NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/book', label: 'Book Slot', icon: CalendarPlus, primary: true },
  { href: '/dashboard', label: 'Live Queue', icon: ListOrdered },
  { href: '/profile', label: 'Profile', icon: UserRound },
];
const ADMIN_NAV = [
  { href: '/admin', label: 'Today', icon: LayoutDashboard },
  { href: '/admin/bookings', label: 'Bookings', icon: ListOrdered },
  { href: '/admin/availability', label: 'Calendar', icon: CalendarDays },
  { href: '/admin/payments', label: 'Payments', icon: Wallet },
  { href: '/admin/more', label: 'More', icon: Menu },
];

export function AppShell({ children, nav = 'user', title, back, right, subtitle, bare }: { children: ReactNode; nav?: NavKind; title?: string; back?: string | boolean; right?: ReactNode; subtitle?: ReactNode; bare?: boolean }) {
  const { settings } = useSettings();
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const items = nav === 'admin' ? ADMIN_NAV : USER_NAV;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {back ? (
              <button onClick={() => (typeof back === 'string' ? router.push(back) : router.back())} aria-label="Back" className="-ml-2 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <Link href={nav === 'admin' ? '/admin' : '/'} className="shrink-0" aria-label="Home">
                <BrandLogo size={38} />
              </Link>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold leading-none tracking-tight text-slate-900">{title || settings.salonName}</h1>
              {subtitle !== undefined ? (
                <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{subtitle}</div>
              ) : nav === 'admin' ? (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-brand-600">
                  <ShieldCheck className="h-3 w-3" /> Barber admin
                </p>
              ) : (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-brand-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" /> Live queue active
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {right}
            {nav === 'user' && isAdmin && (
              <Link href="/admin" className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> Admin
              </Link>
            )}
            {nav === 'user' && !user && (
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white">
                <LogIn className="h-3.5 w-3.5" /> Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={cn('mx-auto w-full max-w-md flex-1', !bare && 'px-4 pt-4', nav === 'none' ? 'pb-8' : 'safe-bottom')}>{children}</main>

      {nav !== 'none' && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className={cn('mx-auto grid h-16 w-full max-w-md text-[11px]', items.length === 5 ? 'grid-cols-5' : 'grid-cols-4')}>
            {items.map((it) => {
              const active = it.href === '/' || it.href === '/admin' ? pathname === it.href : pathname.startsWith(it.href);
              const Icon = it.icon;
              return (
                <Link key={it.href} href={it.href} className={cn('flex flex-col items-center justify-center gap-1 transition', active ? 'font-bold text-brand-600' : 'font-semibold text-slate-400')}>
                  {'primary' in it && it.primary ? (
                    <span className={cn('-mt-3 flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md shadow-brand-600/30', active ? 'bg-brand-700' : 'bg-brand-600')}>
                      <Icon className="h-5 w-5" />
                    </span>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

/** Redirects to /login when not authenticated. */
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hadUser = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (user) hadUser.current = true;
    // A user who just logged out goes home; a visitor who was never logged in goes to login.
    if (!user) router.replace(hadUser.current ? '/' : `/login?next=${encodeURIComponent(pathname)}`);
    else if (admin && !isAdmin) router.replace('/');
  }, [user, loading, isAdmin, admin, router, pathname]);
  if (loading || !user || (admin && !isAdmin)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <>{children}</>;
}
