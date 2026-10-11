'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, ShieldCheck, Ban } from 'lucide-react';
import { AdminShell, LoadingRows } from '@/components/admin';
import { Avatar, EmptyState, Input, Segmented } from '@/components/ui';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import type { User } from '@/lib/types';
import { cn, fmtDate, money } from '@/lib/utils';

interface Client extends User { stats: { total: number; done: number; noShow: number; spent: number; lastVisit: string | null } }

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState<'' | 'user' | 'admin'>('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const list = useAsync(() => api<{ clients: Client[]; total: number }>('/admin/clients', { query: { search: debounced || undefined, role: role || undefined, limit: 100 } }), [debounced, role]);

  return (
    <AdminShell title="Clients" back="/admin/more" subtitle={`${list.data?.total ?? 0} accounts`}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Segmented value={role} onChange={setRole} options={[{ value: '', label: 'All' }, { value: 'user', label: 'Clients' }, { value: 'admin', label: 'Admins' }]} />
        {list.loading && !list.data ? (
          <LoadingRows n={6} />
        ) : !list.data?.clients.length ? (
          <EmptyState title="No clients found" text="Clients appear here once they register or you book a walk-in with a phone number." />
        ) : (
          <div className="card divide-y divide-slate-100 p-0">
            {list.data.clients.map((c) => (
              <Link key={c.id} href={`/admin/clients/${c.id}`} className={cn('flex items-center gap-3 px-4 py-3 active:bg-slate-50', c.isBlocked && 'opacity-60')}>
                <Avatar name={c.name} src={c.avatar?.url} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-slate-900">{c.name}</span>
                    {c.role === 'admin' && <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />}
                    {c.isBlocked && <Ban className="h-3.5 w-3.5 text-red-500" />}
                  </div>
                  <p className="truncate text-[11px] text-slate-500">{c.phone || 'no phone'} &bull; {c.email}</p>
                  <p className="text-[11px] text-slate-400">
                    {c.stats.done} visits &bull; {money(c.stats.spent)} spent{c.stats.noShow ? ` • ${c.stats.noShow} no-show` : ''}{c.stats.lastVisit ? ` • last ${fmtDate(c.stats.lastVisit)}` : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
