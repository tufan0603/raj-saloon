'use client';
import { useState } from 'react';
import dayjs from 'dayjs';
import { Wallet } from 'lucide-react';
import { AdminShell, BarberTabs, BookingActionSheet, LoadingRows, StatCard } from '@/components/admin';
import { Badge, EmptyState, Input, Segmented } from '@/components/ui';
import { api } from '@/lib/api';
import { useAsync, usePolling } from '@/lib/hooks';
import type { Barber, Booking } from '@/lib/types';
import { cn, fmtDate, fmtTime, money, nameOf, PAY_CLASS, PAY_LABEL, STATUS_CLASS, STATUS_LABEL, todayStr } from '@/lib/utils';

type Range = 'today' | 'week' | 'month' | 'custom';
type PayFilter = '' | 'paid' | 'pending' | 'verifying';

export default function PaymentsPage() {
  const today = todayStr();
  const [range, setRange] = useState<Range>('today');
  const [custom, setCustom] = useState({ from: today, to: today });
  const [barberId, setBarberId] = useState('');
  const [pay, setPay] = useState<PayFilter>('');
  const [selected, setSelected] = useState<Booking | null>(null);
  const barbers = useAsync(() => api<{ barbers: Barber[] }>('/admin/barbers').then((r) => r.barbers));

  const { from, to } =
    range === 'today' ? { from: today, to: today }
    : range === 'week' ? { from: dayjs().subtract(6, 'day').format('YYYY-MM-DD'), to: today }
    : range === 'month' ? { from: dayjs().startOf('month').format('YYYY-MM-DD'), to: today }
    : custom;

  const data = usePolling(
    () => api<{ bookings: Booking[]; summary: { paid: number; pending: number; upcoming: number; verifying: number; verifyingCount: number; byMethod: Record<string, number> } }>('/admin/payments', { query: { from, to, barberId, paymentStatus: pay || undefined } }),
    30000,
    [from, to, barberId, pay],
  );
  const s = data.data?.summary;
  const rows = (data.data?.bookings || []).filter((b) => (pay === 'pending' ? b.status === 'done' : true));

  return (
    <AdminShell title="Payments" subtitle="Orders, collections & dues">
      <div className="space-y-3">
        <Segmented<Range> value={range} onChange={setRange} options={[{ value: 'today', label: 'Today' }, { value: 'week', label: '7 days' }, { value: 'month', label: 'Month' }, { value: 'custom', label: 'Custom' }]} />
        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </div>
        )}
        {barbers.data && barbers.data.length > 1 && <BarberTabs barbers={barbers.data} value={barberId} onChange={setBarberId} allowAll />}

        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Collected" value={money(s?.paid)} tone="brand" />
          <StatCard label="Due" value={money(s?.pending)} tone={s?.pending ? 'amber' : 'default'} />
          <StatCard label="Upcoming" value={money(s?.upcoming)} />
        </div>
        {s && s.verifyingCount > 0 && (
          <button onClick={() => setPay('verifying')} className="flex w-full items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-left text-xs">
            <span className="font-bold text-sky-800">{s.verifyingCount} UPI payment{s.verifyingCount > 1 ? 's' : ''} to verify</span>
            <span className="font-black text-sky-900">{money(s.verifying)}</span>
          </button>
        )}
        {s && Object.keys(s.byMethod).length > 0 && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            {Object.entries(s.byMethod).map(([m, v]) => (
              <span key={m} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
                <span className="uppercase">{m}</span>: <b className="text-slate-900">{money(v)}</b>
              </span>
            ))}
          </div>
        )}

        <Segmented<PayFilter> value={pay} onChange={setPay} options={[{ value: '', label: 'All' }, { value: 'paid', label: 'Paid' }, { value: 'verifying', label: 'To verify' }, { value: 'pending', label: 'Unpaid' }]} />

        {data.loading && !data.data ? (
          <LoadingRows n={5} />
        ) : !rows.length ? (
          <EmptyState icon={<Wallet className="h-8 w-8" />} title="No orders" text="Nothing in this range yet." />
        ) : (
          <div className="space-y-2">
            {rows.map((b) => (
              <button key={b._id} onClick={() => setSelected(b)} className="card flex w-full items-center justify-between gap-3 text-left active:bg-slate-50">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">#{b.tokenNumber}</span>
                    <Badge className={cn('border', PAY_CLASS[b.payment.status])}>{PAY_LABEL[b.payment.status]}{b.payment.method ? ` • ${b.payment.method}` : ''}</Badge>
                    <Badge className={STATUS_CLASS[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs font-bold text-slate-900">{b.customerName}</p>
                  <p className="truncate text-[11px] text-slate-500">{b.serviceName} &bull; {nameOf(b.barber)} &bull; {fmtDate(b.date, today)} {fmtTime(b.slotTime)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={cn('block text-sm font-extrabold', b.payment.status === 'paid' ? 'text-brand-600' : 'text-slate-800')}>{money(b.payment.status === 'paid' ? b.payment.amount : b.price)}</span>
                  {b.payment.paidAt && <span className="block text-[10px] text-slate-400">{dayjs(b.payment.paidAt).format('D MMM, h:mm A')}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <BookingActionSheet booking={selected} onClose={() => setSelected(null)} onChanged={() => data.refresh()} />
    </AdminShell>
  );
}
