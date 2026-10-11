'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SkipForward, Plus, Users, Wallet, Clock, CheckCheck, RefreshCw, Phone } from 'lucide-react';
import { AdminShell, BarberTabs, BookForClientSheet, BookingActionSheet, LoadingRows, StatCard } from '@/components/admin';
import { NowServingBanner, QueueRow } from '@/components/booking';
import { Badge, Button, SectionTitle } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useAsync, usePolling } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import type { Barber, Booking, QueueData } from '@/lib/types';
import { cn, fmtTime, idOf, money, STATUS_CLASS, STATUS_LABEL } from '@/lib/utils';

interface Stats {
  date: string;
  today: string;
  totals: { bookings: number; waiting: number; serving: number; done: number; cancelled: number; revenue: number; pendingAmount: number; pendingCount: number; clients: number };
  perBarber: { id: string; name: string; waiting: number; serving: any; done: number; revenue: number }[];
}

export default function AdminHome() {
  const { user } = useAuth();
  const toast = useToast();
  const barbers = useAsync(() => api<{ barbers: Barber[] }>('/admin/barbers').then((r) => r.barbers.filter((b) => b.active)));
  const [barberId, setBarberId] = useState('');
  const [bookOpen, setBookOpen] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    if (barberId || !barbers.data?.length) return;
    const mine = user?.barber ? idOf(user.barber) : '';
    setBarberId(barbers.data.some((b) => b._id === mine) ? mine : barbers.data[0]._id);
  }, [barbers.data, user, barberId]);

  const stats = usePolling(() => api<Stats>('/admin/stats'), 30000);
  const queue = usePolling(barberId ? () => api<{ queue: QueueData }>('/admin/queue', { query: { barberId } }).then((r) => r.queue) : null, 10000, [barberId]);
  const barber = barbers.data?.find((b) => b._id === barberId);

  const refreshAll = () => {
    stats.refresh();
    queue.refresh();
  };

  const callNext = async () => {
    setCalling(true);
    try {
      const res = await api<{ queue: QueueData }>(`/admin/barbers/${barberId}/call-next`, { body: {} });
      queue.setData(res.queue);
      toast.success(res.queue.serving ? `Now serving #${res.queue.serving.tokenNumber} ${res.queue.serving.customerName}` : 'Queue is empty');
      stats.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCalling(false);
    }
  };

  const openBooking = async (id: string) => {
    try {
      const res = await api<{ booking: Booking }>(`/bookings/${id}`);
      setSelected(res.booking);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const t = stats.data?.totals;
  return (
    <AdminShell
      title="Today"
      subtitle={queue.data ? `Live • ${fmtTime(queue.data.now)}` : undefined}
      right={
        <button onClick={refreshAll} aria-label="Refresh" className={cn('rounded-lg p-2 text-slate-500 hover:bg-slate-100', queue.loading && 'animate-spin')}>
          <RefreshCw className="h-4 w-4" />
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Revenue today" value={money(t?.revenue)} tone="brand" icon={<Wallet className="h-3.5 w-3.5" />} />
          <StatCard label="Unpaid" value={<span>{money(t?.pendingAmount)} <span className="text-xs font-semibold opacity-60">({t?.pendingCount ?? 0})</span></span>} tone={t?.pendingCount ? 'amber' : 'default'} />
          <StatCard label="Waiting" value={t?.waiting ?? '-'} icon={<Clock className="h-3.5 w-3.5" />} />
          <StatCard label="Completed" value={t?.done ?? '-'} icon={<CheckCheck className="h-3.5 w-3.5" />} />
        </div>

        {barbers.data && <BarberTabs barbers={barbers.data} value={barberId} onChange={setBarberId} />}

        <NowServingBanner queue={queue.data} barberName={barber?.name} />

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={callNext} loading={calling} disabled={!queue.data || (!queue.data.serving && !queue.data.waiting.length)} className="py-3">
            <SkipForward className="h-4 w-4" /> {queue.data?.serving ? 'Done & call next' : 'Call next client'}
          </Button>
          <Button variant="secondary" onClick={() => setBookOpen(true)} className="py-3">
            <Plus className="h-4 w-4" /> Walk-in / book
          </Button>
        </div>

        {queue.data?.serving && (
          <button onClick={() => openBooking(queue.data!.serving!.id)} className="card flex w-full items-center justify-between text-left">
            <div className="text-xs">
              <span className="font-bold text-slate-900">In chair: #{queue.data.serving.tokenNumber} {queue.data.serving.customerName}</span>
              <span className="block text-slate-500">{queue.data.serving.serviceName} &bull; {money(queue.data.serving.price)} &bull; {queue.data.serving.payment?.status === 'paid' ? 'Paid' : 'Unpaid'}</span>
            </div>
            {queue.data.serving.customerPhone && (
              <a href={`tel:${queue.data.serving.customerPhone}`} onClick={(e) => e.stopPropagation()} className="rounded-lg bg-slate-100 p-2 text-slate-600">
                <Phone className="h-4 w-4" />
              </a>
            )}
          </button>
        )}

        <div className="card">
          <SectionTitle title={`Queue • ${barber?.name || ''}`} action={<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{queue.data?.waiting.length ?? 0} waiting</span>} />
          {queue.loading && !queue.data ? (
            <LoadingRows />
          ) : !queue.data?.waiting.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-xs text-slate-400">No one waiting. Tap &ldquo;Walk-in / book&rdquo; to add a client.</div>
          ) : (
            <div className="space-y-2">{queue.data.waiting.map((item) => <QueueRow key={item.id} item={item} showPhone onClick={() => openBooking(item.id)} />)}</div>
          )}
        </div>

        {queue.data && queue.data.finished.length > 0 && (
          <div className="card">
            <SectionTitle title="Finished today" />
            <div className="space-y-1.5">
              {queue.data.finished.map((f) => (
                <button key={f.id} onClick={() => openBooking(f.id)} className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-xs">
                  <span className="font-semibold text-slate-700">#{f.tokenNumber} {f.customerName} <span className="text-slate-400">&bull; {f.serviceName}</span></span>
                  <span className="flex items-center gap-1.5">
                    {f.status === 'done' && <span className={cn('text-[10px] font-bold', f.payment?.status === 'paid' ? 'text-brand-600' : 'text-amber-600')}>{f.payment?.status === 'paid' ? 'PAID' : 'UNPAID'}</span>}
                    <Badge className={STATUS_CLASS[f.status]}>{STATUS_LABEL[f.status]}</Badge>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {stats.data && stats.data.perBarber.length > 1 && (
          <div className="card">
            <SectionTitle title="Per barber" icon={<Users className="h-4 w-4 text-brand-600" />} />
            <div className="space-y-1.5 text-xs">
              {stats.data.perBarber.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-bold text-slate-800">{b.name}</span>
                  <span className="text-slate-500">{b.waiting} waiting &bull; {b.done} done &bull; <b className="text-brand-700">{money(b.revenue)}</b></span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link href="/admin/bookings" className="btn-secondary w-full">View all bookings</Link>
      </div>

      <BookForClientSheet open={bookOpen} onClose={() => setBookOpen(false)} onCreated={refreshAll} defaultBarberId={barberId} />
      <BookingActionSheet booking={selected} onClose={() => setSelected(null)} onChanged={refreshAll} />
    </AdminShell>
  );
}
