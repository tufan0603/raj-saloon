'use client';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, Ban, Clock, RotateCcw, Save } from 'lucide-react';
import { AdminShell, BarberTabs } from '@/components/admin';
import { Button, Field, Input, SectionTitle, Sheet, Skeleton, Toggle } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import type { Barber, Slot } from '@/lib/types';
import { cn, fmtTime, todayStr, WEEKDAYS } from '@/lib/utils';

interface MonthDay { date: string; open: boolean; start: string; end: string; reason: string; blocked: number; hasOverride: boolean; activeBookings: number; totalBookings: number }
interface DayDetail { date: string; override: any; open: boolean; reason?: string; window?: { start: string; end: string }; slots: Slot[]; bookings: { customerName: string; slotTime: string; duration: number; tokenNumber: number }[] }

export default function AvailabilityPage() {
  const toast = useToast();
  const barbers = useAsync(() => api<{ barbers: Barber[] }>('/admin/barbers').then((r) => r.barbers.filter((b) => b.active)));
  const [barberId, setBarberId] = useState('');
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [day, setDay] = useState<string | null>(null);
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [form, setForm] = useState({ isOff: false, start: '', end: '', blockedSlots: [] as string[], note: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!barberId && barbers.data?.length) setBarberId(barbers.data[0]._id);
  }, [barbers.data, barberId]);

  const monthData = useAsync(barberId ? () => api<{ days: MonthDay[]; defaults: { openTime: string; closeTime: string } }>('/admin/availability/month', { query: { barberId, month } }) : null, [barberId, month]);

  useEffect(() => {
    if (!day || !barberId) return;
    setDetail(null);
    api<DayDetail>('/admin/availability/day', { query: { barberId, date: day } })
      .then((d) => {
        setDetail(d);
        setForm({ isOff: Boolean(d.override?.isOff), start: d.override?.start || '', end: d.override?.end || '', blockedSlots: d.override?.blockedSlots || [], note: d.override?.note || '' });
      })
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, barberId]);

  const grid = useMemo(() => {
    if (!monthData.data) return [];
    const first = dayjs(`${month}-01`);
    const lead = first.day();
    const cells: (MonthDay | null)[] = Array(lead).fill(null);
    return cells.concat(monthData.data.days);
  }, [monthData.data, month]);

  const save = async (patch?: Partial<typeof form>) => {
    if (!day) return;
    const body = { barberId, date: day, ...form, ...patch };
    setSaving(true);
    try {
      const res = await api<{ affectedBookings: number }>('/admin/availability/day', { method: 'PUT', body });
      toast.success(body.isOff ? `Marked off${res.affectedBookings ? ` (${res.affectedBookings} active booking(s) need attention)` : ''}` : 'Availability saved');
      setDay(null);
      monthData.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    if (!day) return;
    setSaving(true);
    try {
      await api('/admin/availability/day', { method: 'DELETE', query: { barberId, date: day } });
      toast.success('Reset to default hours');
      setDay(null);
      monthData.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  const toggleBlock = (t: string) => setForm((f) => ({ ...f, blockedSlots: f.blockedSlots.includes(t) ? f.blockedSlots.filter((x) => x !== t) : [...f.blockedSlots, t].sort() }));

  const today = todayStr();
  return (
    <AdminShell title="Calendar" subtitle="Days off, hours & blocked slots">
      <div className="space-y-3">
        {barbers.data && barbers.data.length > 1 && <BarberTabs barbers={barbers.data} value={barberId} onChange={setBarberId} />}

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setMonth(dayjs(`${month}-01`).subtract(1, 'month').format('YYYY-MM'))} className="rounded-lg p-1.5 hover:bg-slate-100"><ChevronLeft className="h-5 w-5" /></button>
            <h3 className="text-sm font-extrabold text-slate-900">{dayjs(`${month}-01`).format('MMMM YYYY')}</h3>
            <button onClick={() => setMonth(dayjs(`${month}-01`).add(1, 'month').format('YYYY-MM'))} className="rounded-lg p-1.5 hover:bg-slate-100"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold uppercase text-slate-400">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
          {monthData.loading && !monthData.data ? (
            <Skeleton className="h-56" />
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {grid.map((d, i) =>
                d ? (
                  <button
                    key={d.date}
                    onClick={() => setDay(d.date)}
                    className={cn(
                      'flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-bold transition',
                      !d.open ? 'border-red-100 bg-red-50 text-red-400' : d.hasOverride ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-100 bg-slate-50 text-slate-700',
                      d.date === today && 'ring-2 ring-brand-500',
                      d.date < today && 'opacity-50',
                    )}
                  >
                    {dayjs(d.date).format('D')}
                    {d.activeBookings > 0 && <span className="mt-0.5 rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">{d.activeBookings}</span>}
                    {!d.open && <Ban className="mt-0.5 h-3 w-3" />}
                  </button>
                ) : (
                  <span key={`e${i}`} />
                ),
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-red-100 bg-red-50" /> Off</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-amber-200 bg-amber-50" /> Custom hours</span>
            <span className="flex items-center gap-1"><span className="rounded-full bg-brand-600 px-1 text-[9px] text-white">n</span> Active bookings</span>
          </div>
        </div>
        <p className="px-1 text-[11px] text-slate-400">Tap a day to mark it off, change hours, or block individual slots (lunch, breaks). Default hours and weekly offs are set under More &rarr; Salon settings.</p>
      </div>

      <Sheet
        open={Boolean(day)}
        onClose={() => setDay(null)}
        title={day ? dayjs(day).format('dddd, D MMM') : ''}
        footer={
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" onClick={reset} loading={saving} disabled={!detail?.override}><RotateCcw className="h-4 w-4" /> Reset</Button>
            <Button className="col-span-2" onClick={() => save()} loading={saving}><Save className="h-4 w-4" /> Save</Button>
          </div>
        }
      >
        {!detail ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-xs font-bold text-slate-900">Day off</p>
                <p className="text-[11px] text-slate-500">No bookings accepted on this day</p>
              </div>
              <Toggle checked={form.isOff} onChange={(v) => setForm({ ...form, isOff: v })} />
            </div>
            {detail.bookings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                <b>{detail.bookings.length} active booking(s)</b> on this day: {detail.bookings.map((b) => `#${b.tokenNumber} ${b.customerName} ${fmtTime(b.slotTime)}`).join(', ')}. Cancel or move them from Bookings if you take the day off.
              </div>
            )}
            {!form.isOff && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start time" hint={`Default ${fmtTime(monthData.data?.defaults.openTime)}`}>
                    <Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                  </Field>
                  <Field label="End time" hint={`Default ${fmtTime(monthData.data?.defaults.closeTime)}`}>
                    <Input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                  </Field>
                </div>
                <div>
                  <SectionTitle title="Block slots" icon={<Clock className="h-4 w-4 text-brand-600" />} action={form.blockedSlots.length ? <button onClick={() => setForm({ ...form, blockedSlots: [] })} className="text-[11px] font-bold text-red-500">Clear</button> : null} />
                  {!detail.open ? (
                    <p className="text-xs text-slate-400">Closed ({detail.reason}). Turn the day on to manage slots.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {detail.slots.map((s) => {
                        const blocked = form.blockedSlots.includes(s.time);
                        const booked = s.reason === 'booked';
                        return (
                          <button key={s.time} type="button" disabled={booked} onClick={() => toggleBlock(s.time)} className={cn('rounded-lg border py-2 text-[11px] font-semibold', blocked ? 'border-red-300 bg-red-50 text-red-600 line-through' : booked ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700')}>
                            {fmtTime(s.time)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-2 text-[10px] text-slate-400">Green = booked, red = blocked. Tap to block / unblock.</p>
                </div>
              </>
            )}
            <Field label="Note (shown to you only)">
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Family function" />
            </Field>
          </div>
        )}
      </Sheet>
    </AdminShell>
  );
}
