'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarX2, ListOrdered, RefreshCw, History, LogIn } from 'lucide-react';
import { AppShell } from '@/components/shell';
import { BookingCard, NowServingBanner, QueueRow } from '@/components/booking';
import { UpiPaySheet } from '@/components/payment';
import { useSettings } from '@/lib/settings-context';
import { isUpiEnabled } from '@/lib/upi';
import { Avatar, Confirm, EmptyState, SectionTitle, Skeleton } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useAsync, usePolling } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import type { Barber, Booking, QueueData } from '@/lib/types';
import { cn, fmtTime, idOf, nameOf } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const barbers = useAsync(() => api<{ barbers: Barber[] }>('/barbers').then((r) => r.barbers), [], { cacheKey: 'barbers' });
  const [barberId, setBarberId] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [payTarget, setPayTarget] = useState<Booking | null>(null);
  const { settings } = useSettings();
  const upiEnabled = isUpiEnabled(settings);

  const mine = usePolling(user ? () => api<{ today: string; upcoming: Booking[]; past: Booking[] }>('/bookings/mine') : null, 20000, [user?.id]);

  // Default barber: the one from the user's upcoming booking today, else first
  useEffect(() => {
    if (barberId || !barbers.data?.length) return;
    const todayBooking = mine.data?.upcoming.find((b) => b.date === mine.data?.today);
    setBarberId(todayBooking ? idOf(todayBooking.barber) : barbers.data[0]._id);
  }, [barbers.data, mine.data, barberId]);

  const queue = usePolling(barberId ? () => api<{ queue: QueueData }>('/queue', { query: { barberId } }).then((r) => r.queue) : null, 10000, [barberId]);
  const barber = barbers.data?.find((b) => b._id === barberId);

  const myEntry = useMemo(() => {
    if (!user || !queue.data) return null;
    if (queue.data.serving?.userId === user.id) return { ...queue.data.serving, kind: 'serving' as const };
    const w = queue.data.waiting.find((x) => x.userId === user.id);
    return w ? { ...w, kind: 'waiting' as const } : null;
  }, [queue.data, user]);

  const doCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api(`/bookings/${cancelTarget._id}/cancel`, { method: 'PATCH', body: {} });
      toast.success('Booking cancelled');
      setCancelTarget(null);
      mine.refresh();
      queue.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <AppShell
      nav="user"
      title="Live Queue"
      subtitle={queue.data ? `Updated ${fmtTime(queue.data.now)} • auto-refresh` : 'Track your turn in real time'}
      right={
        <button onClick={() => { queue.refresh(); mine.refresh(); }} aria-label="Refresh" className={cn('rounded-lg p-2 text-slate-500 hover:bg-slate-100', queue.loading && 'animate-spin')}>
          <RefreshCw className="h-4 w-4" />
        </button>
      }
    >
      <div className="space-y-4">
        {/* Barber switcher */}
        {barbers.data && barbers.data.length > 1 && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {barbers.data.map((b) => (
              <button key={b._id} onClick={() => setBarberId(b._id)} className={cn('flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-bold transition', b._id === barberId ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600')}>
                <Avatar name={b.name} src={b.avatar?.url} size="sm" className="h-6 w-6 text-[10px]" /> {b.name}
              </button>
            ))}
          </div>
        )}

        <NowServingBanner queue={queue.data} barberName={barber?.name} />

        {/* My turn card */}
        <div className="card">
          {!user ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your position</span>
                <h3 className="text-sm font-bold text-slate-900">Login to track your token</h3>
                <p className="text-xs text-slate-500">See exactly how many clients are ahead of you.</p>
              </div>
              <Link href="/login?next=/dashboard" className="btn-primary px-3.5 py-2 text-xs">
                <LogIn className="h-3.5 w-3.5" /> Login
              </Link>
            </div>
          ) : myEntry?.kind === 'serving' ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">You are in chair!</span>
                <h3 className="text-base font-extrabold text-slate-900">Your turn right now</h3>
                <p className="text-xs text-slate-500">Token #{myEntry.tokenNumber} &bull; {myEntry.serviceName}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-extrabold text-white shadow animate-pulsering">#{myEntry.tokenNumber}</div>
            </div>
          ) : myEntry ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-ping rounded-full bg-brand-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Your position</span>
                  </div>
                  <h3 className="mt-0.5 text-sm font-extrabold text-slate-900">{myEntry.clientsAhead === 0 ? 'You are next in line!' : `${myEntry.clientsAhead} client${myEntry.clientsAhead! > 1 ? 's' : ''} ahead of you`}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Token <strong>#{myEntry.tokenNumber}</strong> ({myEntry.serviceName})
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-semibold text-slate-400">Approx wait</span>
                  <span className="text-lg font-black text-brand-600">~{myEntry.waitMinutes}m</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-600">
                <span>Expected service start</span>
                <span className="font-bold text-slate-900">{fmtTime(myEntry.estimatedStart)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current wait{barber ? ` • ${barber.name}` : ''}</span>
                <h3 className="text-sm font-bold text-slate-900">{queue.data ? (queue.data.waiting.length === 0 ? 'No waiting right now!' : `${queue.data.waiting.length} waiting (~${queue.data.totalWaitMinutes}m)`) : 'Loading...'}</h3>
                <p className="text-xs text-slate-500">Book your slot now to secure your turn</p>
              </div>
              <Link href={`/book?barberId=${barberId}`} className="btn-primary px-3.5 py-2 text-xs">
                Get Token
              </Link>
            </div>
          )}
        </div>

        {/* Queue list */}
        <div className="card">
          <SectionTitle title="Today's Queue" icon={<ListOrdered className="h-4 w-4 text-brand-600" />} action={<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{queue.data?.waiting.length ?? 0} in line</span>} />
          {queue.loading && !queue.data ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : queue.error && !queue.data ? (
            <p className="py-6 text-center text-xs text-red-500">{queue.error}</p>
          ) : !queue.data?.waiting.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-xs text-slate-400">No one waiting in line. Next walk-in goes directly in chair!</div>
          ) : (
            <div className="space-y-2">
              {queue.data.waiting.map((item) => <QueueRow key={item.id} item={item} isMe={Boolean(user && item.userId === user.id)} />)}
            </div>
          )}
        </div>

        {/* My bookings */}
        {user && (
          <>
            <div>
              <SectionTitle title="My Upcoming" action={<Link href="/book" className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-600">+ Book New</Link>} />
              {mine.loading && !mine.data ? (
                <Skeleton className="h-20" />
              ) : !mine.data?.upcoming.length ? (
                <EmptyState icon={<CalendarX2 className="h-8 w-8" />} title="No upcoming bookings" text="Book your hair or beard slot in seconds." action={<Link href="/book" className="btn-primary px-4 py-2 text-xs">Book a slot</Link>} />
              ) : (
                <div className="space-y-2">
                  {mine.data.upcoming.map((b) => <BookingCard key={b._id} b={b} today={mine.data!.today} onCancel={setCancelTarget} onPay={upiEnabled ? setPayTarget : undefined} />)}
                </div>
              )}
            </div>
            {mine.data && mine.data.past.length > 0 && (
              <div>
                <SectionTitle title="Past Visits" icon={<History className="h-4 w-4 text-slate-400" />} />
                <div className="space-y-2">{mine.data.past.slice(0, 10).map((b) => <BookingCard key={b._id} b={b} today={mine.data!.today} compact />)}</div>
              </div>
            )}
          </>
        )}
      </div>

      <UpiPaySheet booking={payTarget} open={Boolean(payTarget)} onClose={() => setPayTarget(null)} onClaimed={() => { setPayTarget(null); mine.refresh(); }} />
      <Confirm
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={doCancel}
        loading={cancelling}
        danger
        title="Cancel this booking?"
        confirmText="Yes, cancel"
        text={cancelTarget ? `Token #${cancelTarget.tokenNumber} for ${cancelTarget.serviceName} with ${nameOf(cancelTarget.barber, 'the barber')} will be released.` : ''}
      />
    </AppShell>
  );
}
