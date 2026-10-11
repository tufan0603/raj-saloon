'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { AdminShell, BarberTabs, BookForClientSheet, BookingActionSheet, DateNav, LoadingRows } from '@/components/admin';
import { Badge, EmptyState, Input, Segmented } from '@/components/ui';
import { api } from '@/lib/api';
import { useAsync, usePolling } from '@/lib/hooks';
import type { Barber, Booking, BookingStatus } from '@/lib/types';
import { cn, fmtTime, money, nameOf, PAY_CLASS, PAY_LABEL, STATUS_CLASS, STATUS_LABEL, todayStr } from '@/lib/utils';

type Filter = 'all' | 'active' | 'done' | 'cancelled';

function AdminBookingsInner() {
  // deep links from notifications: /admin/bookings?date=YYYY-MM-DD&q=<client name or token>
  const params = useSearchParams();
  const [date, setDate] = useState(params.get('date') || todayStr());
  const [barberId, setBarberId] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState(params.get('q') || '');
  const [bookOpen, setBookOpen] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const barbers = useAsync(() => api<{ barbers: Barber[] }>('/admin/barbers').then((r) => r.barbers));

  const list = usePolling(
    () => api<{ bookings: Booking[]; total: number }>('/admin/bookings', { query: { date: search ? undefined : date, barberId, search: search || undefined, limit: 200 } }),
    20000,
    [date, barberId, search],
  );

  const rows = (list.data?.bookings || []).filter((b) => {
    if (filter === 'active') return b.status === 'waiting' || b.status === 'serving';
    if (filter === 'done') return b.status === 'done';
    if (filter === 'cancelled') return b.status === 'cancelled' || b.status === 'no_show';
    return true;
  });
  const counts = (s: BookingStatus[]) => (list.data?.bookings || []).filter((b) => s.includes(b.status)).length;

  return (
    <AdminShell title="Bookings" subtitle={`${list.data?.total ?? 0} on ${search ? 'search' : date === todayStr() ? 'today' : date}`} right={<button onClick={() => setBookOpen(true)} className="btn-primary px-3 py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> New</button>}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search name, phone or token (all dates)" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {!search && <DateNav date={date} onChange={setDate} />}
        {barbers.data && barbers.data.length > 1 && <BarberTabs barbers={barbers.data} value={barberId} onChange={setBarberId} allowAll />}
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All (${list.data?.bookings.length ?? 0})` },
            { value: 'active', label: `Active (${counts(['waiting', 'serving'])})` },
            { value: 'done', label: `Done (${counts(['done'])})` },
            { value: 'cancelled', label: `Cancelled (${counts(['cancelled', 'no_show'])})` },
          ]}
        />

        {list.loading && !list.data ? (
          <LoadingRows n={5} />
        ) : !rows.length ? (
          <EmptyState title="No bookings" text={search ? 'Nothing matches your search.' : 'No bookings for this filter. Add a walk-in with the New button.'} />
        ) : (
          <div className="space-y-2">
            {rows.map((b) => (
              <button key={b._id} onClick={() => setSelected(b)} className="card flex w-full items-center justify-between gap-3 text-left active:bg-slate-50">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">#{b.tokenNumber}</span>
                    <Badge className={STATUS_CLASS[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                    <Badge className={cn('border', PAY_CLASS[b.payment.status])}>{PAY_LABEL[b.payment.status]}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs font-bold text-slate-900">{b.customerName} <span className="font-normal text-slate-400">{b.customerPhone}</span></p>
                  <p className="truncate text-[11px] text-slate-500">
                    {b.serviceName} &bull; {nameOf(b.barber)} {search && <>&bull; {b.date}</>}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-xs font-bold text-slate-800">{fmtTime(b.slotTime)}</span>
                  <span className="block text-[11px] font-semibold text-brand-600">{money(b.price)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <BookForClientSheet open={bookOpen} onClose={() => setBookOpen(false)} onCreated={() => list.refresh()} defaultDate={date} defaultBarberId={barberId || undefined} />
      <BookingActionSheet booking={selected} onClose={() => setSelected(null)} onChanged={() => list.refresh()} />
    </AdminShell>
  );
}

export default function AdminBookings() {
  return (
    <Suspense>
      <AdminBookingsInner />
    </Suspense>
  );
}
