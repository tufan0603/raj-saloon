'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Scissors, Users, Image as ImageIcon, Settings, UserRound, LogOut, ChevronRight, Smartphone, Contact, QrCode } from 'lucide-react';
import { AdminShell } from '@/components/admin';
import { Avatar, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';

const ITEMS = [
  { href: '/admin/services', icon: Scissors, title: 'Services & prices', text: 'Add services, change rates and durations' },
  { href: '/admin/barbers', icon: Users, title: 'Barbers', text: 'Staff profiles, photos, working hours' },
  { href: '/admin/clients', icon: Contact, title: 'Clients', text: 'Customer list, history, block users' },
  { href: '/admin/content', icon: ImageIcon, title: 'Content & gallery', text: 'Hero image, photos, videos, announcements' },
  { href: '/admin/settings', icon: Settings, title: 'Salon settings', text: 'Hours, weekly off, slot size, booking rules' },
  { href: '/admin/qr', icon: QrCode, title: 'QR code & shop card', text: 'Download the booking QR and a printable shop card' },
];

export default function MorePage() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();
  return (
    <AdminShell title="More" subtitle={settings.salonName}>
      <div className="space-y-4">
        <div className="card flex items-center gap-3">
          <Avatar name={user?.name || ''} src={user?.avatar?.url} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-extrabold text-slate-900">{user?.name}</h2>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
          <Link href="/profile" className="rounded-lg bg-slate-100 p-2 text-slate-600" aria-label="Edit profile">
            <UserRound className="h-4 w-4" />
          </Link>
        </div>

        <div className="card divide-y divide-slate-100 p-0">
          {ITEMS.map((it) => (
            <Link key={it.href} href={it.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <it.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900">{it.title}</span>
                <span className="block truncate text-[11px] text-slate-500">{it.text}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </Link>
          ))}
        </div>

        <Link href="/" className="btn-secondary w-full">
          <Smartphone className="h-4 w-4" /> View app as client
        </Link>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            logout();
            router.replace('/');
          }}
        >
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>
    </AdminShell>
  );
}
