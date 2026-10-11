'use client';
import { useMemo } from 'react';
import { Check, Clock, Ticket, Sparkles, UserRound, CalendarX2 } from 'lucide-react';
import dayjs from 'dayjs';
import type { Barber, Booking, QueueData, QueueEntry, Service, Slot } from '@/lib/types';
import { cn, fmtDate, fmtTime, money, nameOf, STATUS_CLASS, STATUS_LABEL, PAY_CLASS, PAY_LABEL, todayStr } from '@/lib/utils';
import { Avatar, Badge, Button, Sheet } from './ui';

export function BarberPicker({ barbers, value, onChange }: { barbers: Barber[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {barbers.map((b) => {
        const sel = b._id === value;
        return (
          <button key={b._id} type="button" onClick={() => onChange(b._id)} className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition', sel ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-500' : 'border-slate-200 bg-slate-50 text-slate-600')}>
            <Avatar name={b.name} src={b.avatar?.url} size="md" className={cn(sel && 'ring-2 ring-brand-500 ring-offset-1')} />
            <span className="truncate">{b.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ServicePicker({ services, value, onChange }: { services: Service[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {services.map((s) => {
        const sel = s._id === value;
        return (
          <button key={s._id} type="button" onClick={() => onChange(s._id)} className={cn('flex w-full items-center justify-between rounded-xl border p-3 text-left transition', sel ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : s.popular ? 'border-brand-200 bg-brand-50/30' : 'border-slate-200 bg-slate-50')}>
            <div className="flex items-center gap-2.5">
              <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', sel ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white')}>{sel && <Check className="h-3 w-3" />}</span>
              <div>
                <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-900">
                  {s.name}
                  {s.popular && <span className="rounded bg-brand-600 px-1.5 py-[1px] text-[9px] font-bold uppercase text-white">{s.compareAtPrice && s.compareAtPrice > s.price ? `Save ${money(s.compareAtPrice - s.price)}` : 'Popular'}</span>}
                </span>
                <span className="text-[11px] text-slate-500">{s.duration} mins{s.description ? ` • ${s.description}` : ''}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-sm font-extrabold text-slate-900">{money(s.price)}</span>
              {s.compareAtPrice && s.compareAtPrice > s.price ? <span className="text-[10px] text-slate-400 line-through">{money(s.compareAtPrice)}</span> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function DateStrip({ dates, value, onChange, today }: { dates: string[]; value: string; onChange: (d: string) => void; today: string }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {dates.map((d) => {
        const sel = d === value;
        const dj = dayjs(d);
        return (
          <button key={d} type="button" onClick={() => onChange(d)} className={cn('flex w-[62px] shrink-0 flex-col items-center rounded-xl border py-2 transition', sel ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600')}>
            <span className={cn('text-[10px] font-semibold uppercase', sel ? 'text-brand-100' : 'text-slate-400')}>{d === today ? 'Today' : dj.format('ddd')}</span>
            <span className="text-lg font-extrabold leading-tight">{dj.format('D')}</span>
            <span className={cn('text-[10px]', sel ? 'text-brand-100' : 'text-slate-400')}>{dj.format('MMM')}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SlotGrid({ slots, value, onChange, open, reason, showUnavailable = true }: { slots: Slot[]; value: string; onChange: (t: string) => void; open: boolean; reason?: string; showUnavailable?: boolean }) {
  const groups = useMemo(() => {
    const g: Record<string, Slot[]> = { Morning: [], Afternoon: [], Evening: [] };
    slots.forEach((s) => {
      const h = Number(s.time.split(':')[0]);
      (h < 12 ? g.Morning : h < 17 ? g.Afternoon : g.Evening).push(s);
    });
    return Object.entries(g).filter(([, v]) => v.length);
  }, [slots]);

  if (!open) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <CalendarX2 className="h-4 w-4 text-slate-400" /> Not available on this day{reason ? ` (${reason})` : ''}. Pick another date or barber.
      </div>
    );
  }
  if (!slots.some((s) => s.available)) {
    return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">All slots are full for this day. Try another date or barber.</div>;
  }
  return (
    <div className="space-y-3">
      {groups.map(([label, list]) => {
        const visible = showUnavailable ? list : list.filter((s) => s.available);
        if (!visible.length) return null;
        return (
          <div key={label}>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {visible.map((s) => {
                const sel = s.time === value;
                return (
                  <button key={s.time} type="button" disabled={!s.available} onClick={() => onChange(s.time)} className={cn('rounded-lg border py-2 text-[11px] font-semibold transition', sel ? 'border-brand-600 bg-brand-600 text-white' : s.available ? 'border-slate-200 bg-white text-slate-700 active:bg-brand-50' : 'border-slate-100 bg-slate-50 text-slate-300 line-through')}>
                    {fmtTime(s.time)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TokenSuccess({ booking, onClose, barberName, onPay }: { booking: Booking | null; onClose: () => void; barberName?: string; onPay?: () => void }) {
  return (
    <Sheet open={Boolean(booking)} onClose={onClose}>
      {booking && (
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">Token Reserved!</h3>
          <p className="mt-0.5 text-xs text-slate-500">Show this token when you arrive.</p>
          <div className="my-4 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[10px] font-semibold uppercase text-slate-400">Your token number</div>
            <div className="font-mono text-4xl font-black text-brand-600">#{booking.tokenNumber}</div>
            <div className="text-xs font-semibold text-slate-700">{booking.serviceName} ({booking.duration}m) &bull; {money(booking.price)}</div>
            <div className="text-[11px] text-slate-500">{barberName || nameOf(booking.barber)} &bull; {fmtDate(booking.date)} at {fmtTime(booking.slotTime)}</div>
          </div>
          {onPay && booking.payment?.status === 'pending' && (
            <Button className="mb-2 w-full" onClick={onPay}>
              Pay {money(booking.price)} now via UPI
            </Button>
          )}
          <Button variant={onPay && booking.payment?.status === 'pending' ? 'secondary' : 'primary'} className="w-full" onClick={onClose}>
            <Ticket className="h-4 w-4" /> Track in Live Queue
          </Button>
          {onPay && booking.payment?.status === 'pending' && <p className="mt-2 text-[11px] text-slate-400">You can also pay later from Live Queue, or at the salon.</p>}
        </div>
      )}
    </Sheet>
  );
}

export function QueueRow({ item, isMe, onClick, showPhone }: { item: QueueEntry; isMe?: boolean; onClick?: () => void; showPhone?: boolean }) {
  return (
    <div onClick={onClick} className={cn('flex items-center justify-between rounded-xl border p-2.5', isMe ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-400' : 'border-slate-100 bg-slate-50', onClick && 'cursor-pointer active:bg-slate-100')}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn('shrink-0 rounded-lg px-2 py-1 font-mono text-xs font-bold', isMe ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-700')}>#{item.tokenNumber}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-bold text-slate-900">{item.customerName}</span>
            {isMe && <span className="rounded bg-brand-600 px-1.5 py-[1px] text-[9px] font-extrabold text-white">YOU</span>}
          </div>
          <span className="block truncate text-[11px] text-slate-500">
            {item.serviceName} ({money(item.price)}){showPhone && item.customerPhone ? ` • ${item.customerPhone}` : ''}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className="block text-xs font-bold text-slate-800">{fmtTime(item.estimatedStart || item.slotTime)}</span>
        <span className="block text-[10px] text-slate-400">{item.waitMinutes !== undefined ? `in ~${item.waitMinutes}m` : fmtTime(item.slotTime)}</span>
      </div>
    </div>
  );
}

export function NowServingBanner({ queue, barberName }: { queue: QueueData | null; barberName?: string }) {
  const s = queue?.serving;
  return (
    <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-teal-700 p-4 text-white shadow-md">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-brand-100">
        <span>Now in chair{barberName ? ` • ${barberName}` : ''}</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{s ? 'Serving' : 'Free'}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-lg font-extrabold text-brand-700 shadow">{s ? `#${s.tokenNumber}` : <UserRound className="h-5 w-5" />}</div>
          <div>
            <h2 className="text-base font-bold">{s ? s.customerName : 'Chair available'}</h2>
            <p className="text-xs text-brand-100">{s ? `${s.serviceName} (${money(s.price)})` : 'No client currently in chair'}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-medium uppercase text-brand-100">{s ? 'Finishing in' : 'Status'}</span>
          <p className="text-sm font-extrabold">{s ? `~${s.remainingMinutes ?? 0} mins` : 'Ready'}</p>
        </div>
      </div>
    </div>
  );
}

export function BookingCard({ b, onCancel, onPay, today = todayStr(), compact }: { b: Booking; onCancel?: (b: Booking) => void; onPay?: (b: Booking) => void; today?: string; compact?: boolean }) {
  const canPay = Boolean(onPay) && b.payment?.status === 'pending' && b.status !== 'cancelled' && b.status !== 'no_show';
  return (
    <div className="card flex items-center justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">#{b.tokenNumber}</span>
          <Badge className={STATUS_CLASS[b.status]}>{STATUS_LABEL[b.status]}</Badge>
          {(b.status === 'done' || b.payment?.status !== 'pending') && <Badge className={cn('border', PAY_CLASS[b.payment.status])}>{PAY_LABEL[b.payment.status]}</Badge>}
        </div>
        <h4 className="truncate text-xs font-bold text-slate-900">{b.serviceName}</h4>
        <p className="flex flex-wrap items-center gap-x-1 text-[11px] text-slate-500">
          <Clock className="h-3 w-3 text-slate-400" /> {fmtDate(b.date, today)} &bull; {fmtTime(b.slotTime)} &bull; {money(b.price)}
          {!compact && <span className="w-full text-slate-400">with {nameOf(b.barber, 'barber')}</span>}
        </p>
      </div>
      {(canPay || (onCancel && b.status === 'waiting')) && (
        <div className="flex shrink-0 flex-col items-stretch gap-1.5">
          {canPay && (
            <button onClick={() => onPay!(b)} className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11px] font-bold text-white active:bg-brand-700">
              Pay UPI
            </button>
          )}
          {onCancel && b.status === 'waiting' && (
            <button onClick={() => onCancel(b)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-500 active:bg-red-100">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PopularTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-brand-600 px-1.5 py-[1px] text-[9px] font-bold uppercase text-white">
      <Sparkles className="h-2.5 w-2.5" /> Popular
    </span>
  );
}
