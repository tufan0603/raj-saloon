'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Phone, MessageCircle, Play, CheckCheck, UserX, XCircle, Wallet, CalendarClock, Upload, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { AppShell, RequireAuth } from './shell';
import { BarberPicker, DateStrip, ServicePicker, SlotGrid } from './booking';
import { Avatar, Badge, Button, Field, Input, Select, Sheet, Skeleton, Textarea } from './ui';
import { useToast } from './toast';
import { AdminBell } from './notifications';
import { api, uploadFiles } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import type { Barber, Booking, Media, PaymentMethod, Service, SlotsResponse } from '@/lib/types';
import { cn, fmtDate, fmtTime, idOf, money, nameOf, PAY_CLASS, PAY_LABEL, STATUS_CLASS, STATUS_LABEL, todayStr, waLink } from '@/lib/utils';

export function AdminShell({ children, title, subtitle, right, back }: { children: ReactNode; title?: string; subtitle?: ReactNode; right?: ReactNode; back?: string | boolean }) {
  return (
    <RequireAuth admin>
      <AppShell
        nav="admin"
        title={title}
        subtitle={subtitle}
        back={back}
        right={
          <>
            {right}
            <AdminBell />
          </>
        }
      >
        {children}
      </AppShell>
    </RequireAuth>
  );
}

export function StatCard({ label, value, icon, tone = 'default', onClick }: { label: string; value: ReactNode; icon?: ReactNode; tone?: 'default' | 'brand' | 'amber' | 'red'; onClick?: () => void }) {
  const tones = { default: 'bg-white border-slate-200 text-slate-900', brand: 'bg-brand-600 border-brand-600 text-white', amber: 'bg-amber-50 border-amber-200 text-amber-900', red: 'bg-red-50 border-red-200 text-red-800' };
  return (
    <div onClick={onClick} className={cn('rounded-2xl border p-3 shadow-card', tones[tone], onClick && 'cursor-pointer active:scale-[0.98]')}>
      <div className={cn('flex items-center justify-between text-[10px] font-bold uppercase tracking-wider', tone === 'brand' ? 'text-brand-100' : 'opacity-60')}>
        {label} {icon}
      </div>
      <div className="mt-1 text-xl font-black leading-tight">{value}</div>
    </div>
  );
}

export function DateNav({ date, onChange, today = todayStr() }: { date: string; onChange: (d: string) => void; today?: string }) {
  const shift = (n: number) => onChange(dayjs(date).add(n, 'day').format('YYYY-MM-DD'));
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-1">
      <button onClick={() => shift(-1)} aria-label="Previous day" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2">
        <input type="date" value={date} onChange={(e) => e.target.value && onChange(e.target.value)} className="rounded-lg bg-transparent text-center text-sm font-bold text-slate-900 outline-none" />
        {date !== today && (
          <button onClick={() => onChange(today)} className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
            Today
          </button>
        )}
      </div>
      <button onClick={() => shift(1)} aria-label="Next day" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function BarberTabs({ barbers, value, onChange, allowAll }: { barbers: Barber[]; value: string; onChange: (id: string) => void; allowAll?: boolean }) {
  const items = allowAll ? [{ _id: '', name: 'All' } as Barber, ...barbers] : barbers;
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
      {items.map((b) => (
        <button key={b._id || 'all'} onClick={() => onChange(b._id)} className={cn('flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-bold transition', b._id === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600')}>
          {b._id ? <Avatar name={b.name} src={b.avatar?.url} size="sm" className="h-6 w-6 text-[10px]" /> : <span className="ml-1.5" />}
          {b.name}
        </button>
      ))}
    </div>
  );
}

/** Upload button for Cloudinary media via the API. */
export function MediaUploader({ folder, multiple, accept = 'image/*', onUploaded, label = 'Upload', className }: { folder: string; multiple?: boolean; accept?: string; onUploaded: (media: Media[]) => void; label?: string; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      const res = await uploadFiles(files, folder);
      onUploaded(res.media);
      toast.success(`${res.media.length} file${res.media.length > 1 ? 's' : ''} uploaded`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden" onChange={pick} />
      <Button type="button" variant="secondary" className={className} loading={busy} onClick={() => ref.current?.click()}>
        {!busy && <Upload className="h-4 w-4" />} {label}
      </Button>
    </>
  );
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
];

/** All admin actions for a single booking. */
export function BookingActionSheet({ booking, onClose, onChanged }: { booking: Booking | null; onClose: () => void; onChanged: (b?: Booking) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<'actions' | 'pay' | 'move' | 'cancel' | 'delete'>('actions');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [move, setMove] = useState({ barberId: '', date: '', slotTime: '' });
  const [slots, setSlots] = useState<SlotsResponse | null>(null);
  const barbers = useAsync(booking ? () => api<{ barbers: Barber[] }>('/barbers').then((r) => r.barbers) : null, [Boolean(booking)]);

  useEffect(() => {
    if (!booking) return;
    setMode('actions');
    setAmount(booking.payment.amount || booking.price);
    setMethod(booking.payment.method || 'cash');
    setMove({ barberId: idOf(booking.barber), date: booking.date, slotTime: booking.slotTime });
    setReason('');
  }, [booking]);

  useEffect(() => {
    if (!booking || mode !== 'move' || !move.barberId || !move.date) return;
    api<SlotsResponse>('/slots', { query: { barberId: move.barberId, serviceId: idOf(booking.service), date: move.date } })
      .then(setSlots)
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking, mode, move.barberId, move.date]);

  if (!booking) return null;
  const run = async (key: string, fn: () => Promise<any>, msg: string) => {
    setBusy(key);
    try {
      const res = await fn();
      toast.success(msg);
      onChanged(res?.booking);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };
  const setStatus = (status: string, msg: string, extra: any = {}) => run(status, () => api(`/admin/bookings/${booking._id}/status`, { method: 'PATCH', body: { status, ...extra } }), msg);
  const active = booking.status === 'waiting' || booking.status === 'serving';
  const user = typeof booking.user === 'object' ? booking.user : null;

  return (
    <Sheet open onClose={onClose} title={<span>Token #{booking.tokenNumber} &bull; {booking.customerName}</span>}>
      <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={STATUS_CLASS[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
          <Badge className={cn('border', PAY_CLASS[booking.payment.status])}>{PAY_LABEL[booking.payment.status]}{booking.payment.status === 'paid' && booking.payment.method ? ` • ${booking.payment.method}` : ''}</Badge>
          <span className="ml-auto text-[10px] uppercase text-slate-400">{booking.source.replace('_', ' ')}</span>
        </div>
        <p className="mt-2 font-bold text-slate-900">{booking.serviceName} &bull; {money(booking.price)} &bull; {booking.duration}m</p>
        <p className="text-slate-600">{fmtDate(booking.date)} at {fmtTime(booking.slotTime)} with {nameOf(booking.barber)}</p>
        {(booking.customerPhone || user?.email) && <p className="mt-1 text-slate-500">{booking.customerPhone}{user?.email ? ` • ${user.email}` : ''}</p>}
        {booking.notes && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-amber-800">Note: {booking.notes}</p>}
        {booking.customerPhone && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a href={`tel:${booking.customerPhone}`} className="btn-secondary py-2 text-xs"><Phone className="h-3.5 w-3.5" /> Call</a>
            <a href={waLink(booking.customerPhone, `Hi ${booking.customerName}, your token #${booking.tokenNumber} is coming up. Please reach the salon.`)} target="_blank" rel="noreferrer" className="btn-secondary py-2 text-xs"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
          </div>
        )}
      </div>

      {mode === 'actions' && (
        <div className="space-y-2">
          {booking.payment.status === 'verifying' && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs font-bold text-sky-800">Client says they paid {money(booking.payment.amount || booking.price)} via UPI</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">Ref: {booking.payment.reference || '-'}</p>
              <p className="text-[11px] text-sky-700">Match this with your bank / UPI app SMS, then confirm.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="secondary" className="py-2 text-xs" loading={busy === 'reject'} onClick={() => run('reject', () => api(`/admin/bookings/${booking._id}/payment`, { method: 'PATCH', body: { status: 'pending', method: null } }), 'Marked as unpaid')}>Not received</Button>
                <Button className="py-2 text-xs" loading={busy === 'confirm'} onClick={() => run('confirm', () => api(`/admin/bookings/${booking._id}/payment`, { method: 'PATCH', body: { status: 'paid', method: 'upi', amount: booking.payment.amount || booking.price, reference: booking.payment.reference } }), 'UPI payment confirmed')}><CheckCheck className="h-4 w-4" /> Confirm received</Button>
              </div>
            </div>
          )}
          {booking.status === 'waiting' && <Button className="w-full" loading={busy === 'serving'} onClick={() => setStatus('serving', 'Client is now in chair')}><Play className="h-4 w-4" /> Start service (in chair)</Button>}
          {booking.status === 'serving' && <Button className="w-full" loading={busy === 'done'} onClick={() => setStatus('done', 'Service completed')}><CheckCheck className="h-4 w-4" /> Complete service</Button>}
          {booking.payment.status !== 'paid' && booking.status !== 'cancelled' && booking.status !== 'no_show' && <Button variant="secondary" className="w-full" onClick={() => setMode('pay')}><Wallet className="h-4 w-4" /> Mark as paid</Button>}
          {booking.payment.status === 'paid' && <Button variant="secondary" className="w-full" loading={busy === 'unpay'} onClick={() => run('unpay', () => api(`/admin/bookings/${booking._id}/payment`, { method: 'PATCH', body: { status: 'pending' } }), 'Marked unpaid')}><RotateCcw className="h-4 w-4" /> Mark as unpaid</Button>}
          {active && <Button variant="secondary" className="w-full" onClick={() => setMode('move')}><CalendarClock className="h-4 w-4" /> Reschedule / change barber</Button>}
          {booking.status === 'waiting' && <Button variant="secondary" className="w-full text-orange-700" loading={busy === 'no_show'} onClick={() => setStatus('no_show', 'Marked as no-show')}><UserX className="h-4 w-4" /> No show</Button>}
          {active && <Button variant="danger" className="w-full" onClick={() => setMode('cancel')}><XCircle className="h-4 w-4" /> Cancel booking</Button>}
          {(booking.status === 'cancelled' || booking.status === 'no_show' || booking.status === 'done') && <Button variant="secondary" className="w-full" loading={busy === 'waiting'} onClick={() => setStatus('waiting', 'Moved back to waiting')}><RotateCcw className="h-4 w-4" /> Reopen as waiting</Button>}
          <button onClick={() => setMode('delete')} className="w-full py-2 text-center text-xs font-semibold text-slate-400 underline-offset-2 hover:text-red-500 hover:underline">
            Delete this booking permanently
          </button>
        </div>
      )}

      {mode === 'delete' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            This removes token #{booking.tokenNumber} from all records, including payments and the client&apos;s history. Prefer <b>Cancel</b> or <b>No show</b> if you want to keep the history.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setMode('actions')}>Back</Button>
            <Button variant="danger" loading={busy === 'delete'} onClick={() => run('delete', () => api(`/admin/bookings/${booking._id}`, { method: 'DELETE' }), 'Booking deleted')}><Trash2 className="h-4 w-4" /> Delete permanently</Button>
          </div>
        </div>
      )}

      {mode === 'pay' && (
        <div className="space-y-3">
          <Field label="Amount received">
            <Input type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Payment method">
            <div className="grid grid-cols-4 gap-1.5">
              {METHODS.map((m) => (
                <button key={m.value} type="button" onClick={() => setMethod(m.value)} className={cn('rounded-lg border py-2 text-xs font-bold', method === m.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600')}>{m.label}</button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setMode('actions')}>Back</Button>
            <Button loading={busy === 'pay'} onClick={() => run('pay', () => api(`/admin/bookings/${booking._id}/payment`, { method: 'PATCH', body: { status: 'paid', method, amount } }), `Paid ${money(amount)} via ${method}`)}>Confirm paid</Button>
          </div>
        </div>
      )}

      {mode === 'move' && (
        <div className="space-y-3">
          <Field label="Barber">{barbers.data ? <BarberPicker barbers={barbers.data} value={move.barberId} onChange={(id) => setMove({ ...move, barberId: id, slotTime: '' })} /> : <Skeleton className="h-16" />}</Field>
          <Field label="Date">
            <Input type="date" value={move.date} onChange={(e) => setMove({ ...move, date: e.target.value, slotTime: '' })} />
          </Field>
          <Field label="Slot">{slots ? <SlotGrid slots={slots.slots} value={move.slotTime} onChange={(t) => setMove({ ...move, slotTime: t })} open={slots.open} reason={slots.reason} showUnavailable={false} /> : <Skeleton className="h-24" />}</Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setMode('actions')}>Back</Button>
            <Button disabled={!move.slotTime} loading={busy === 'move'} onClick={() => run('move', () => api(`/admin/bookings/${booking._id}`, { method: 'PATCH', body: move }), 'Booking moved')}>Move booking</Button>
          </div>
        </div>
      )}

      {mode === 'cancel' && (
        <div className="space-y-3">
          <Field label="Reason (optional)">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Barber unavailable" className="min-h-[64px]" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setMode('actions')}>Back</Button>
            <Button variant="danger" loading={busy === 'cancelled'} onClick={() => setStatus('cancelled', 'Booking cancelled', { reason })}>Cancel booking</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Admin books a slot on behalf of a client (walk-in or phone call). */
export function BookForClientSheet({ open, onClose, onCreated, defaultBarberId, defaultDate, client }: { open: boolean; onClose: () => void; onCreated: (b: Booking) => void; defaultBarberId?: string; defaultDate?: string; client?: { id?: string; name: string; phone: string } }) {
  const toast = useToast();
  const barbers = useAsync(open ? () => api<{ barbers: Barber[] }>('/admin/barbers').then((r) => r.barbers.filter((b) => b.active)) : null, [open]);
  const services = useAsync(open ? () => api<{ services: Service[] }>('/admin/services').then((r) => r.services.filter((s) => s.active)) : null, [open]);
  const dates = useAsync(open ? () => api<{ today: string; dates: string[] }>('/dates') : null, [open]);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', barberId: '', serviceId: '', date: '', slotTime: '', notes: '', markPaid: false, paymentMethod: 'cash' as PaymentMethod });
  const [slots, setSlots] = useState<SlotsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const set = useCallback((patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch })), []);

  useEffect(() => {
    if (!open) return;
    setForm((f) => ({ ...f, customerName: client?.name || '', customerPhone: client?.phone || '', barberId: defaultBarberId || f.barberId, date: defaultDate || f.date, slotTime: '' }));
    setSlots(null);
  }, [open, client, defaultBarberId, defaultDate]);
  useEffect(() => {
    if (barbers.data?.length && !barbers.data.some((b) => b._id === form.barberId)) set({ barberId: barbers.data[0]._id });
  }, [barbers.data, form.barberId, set]);
  useEffect(() => {
    if (services.data?.length && !services.data.some((s) => s._id === form.serviceId)) set({ serviceId: services.data[0]._id });
  }, [services.data, form.serviceId, set]);
  useEffect(() => {
    if (dates.data && !form.date) set({ date: dates.data.today });
  }, [dates.data, form.date, set]);
  useEffect(() => {
    if (!open || !form.barberId || !form.serviceId || !form.date) return;
    api<SlotsResponse>('/slots', { query: { barberId: form.barberId, serviceId: form.serviceId, date: form.date } })
      .then((r) => {
        setSlots(r);
        setForm((f) => ({ ...f, slotTime: r.slots.find((s) => s.time === f.slotTime && s.available) ? f.slotTime : r.slots.find((s) => s.available)?.time || '' }));
      })
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.barberId, form.serviceId, form.date]);

  const submit = async () => {
    if (!form.customerName.trim()) return toast.error('Enter client name');
    if (!form.slotTime) return toast.error('Pick a slot');
    setBusy(true);
    try {
      const res = await api<{ booking: Booking }>('/admin/bookings', { body: { ...form, userId: client?.id || undefined, source: 'walk_in' } });
      toast.success(`Token #${res.booking.tokenNumber} created for ${res.booking.customerName}`);
      onCreated(res.booking);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Book for a client" footer={<Button className="w-full" loading={busy} onClick={submit}>Create token{form.slotTime ? ` • ${fmtTime(form.slotTime)}` : ''}</Button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Client name"><Input value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} placeholder="Name" /></Field>
          <Field label="Mobile"><Input type="tel" inputMode="numeric" maxLength={10} value={form.customerPhone} onChange={(e) => set({ customerPhone: e.target.value })} placeholder="Optional" /></Field>
        </div>
        <Field label="Barber">{barbers.data ? <BarberPicker barbers={barbers.data} value={form.barberId} onChange={(id) => set({ barberId: id })} /> : <Skeleton className="h-16" />}</Field>
        <Field label="Service">{services.data ? <ServicePicker services={services.data} value={form.serviceId} onChange={(id) => set({ serviceId: id })} /> : <Skeleton className="h-32" />}</Field>
        <Field label="Date">{dates.data ? <DateStrip dates={dates.data.dates} value={form.date} onChange={(d) => set({ date: d })} today={dates.data.today} /> : <Skeleton className="h-14" />}</Field>
        <Field label="Slot">{slots ? <SlotGrid slots={slots.slots} value={form.slotTime} onChange={(t) => set({ slotTime: t })} open={slots.open} reason={slots.reason} showUnavailable={false} /> : <Skeleton className="h-24" />}</Field>
        <Field label="Note"><Input value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Optional" /></Field>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={form.markPaid} onChange={(e) => set({ markPaid: e.target.checked })} className="h-4 w-4 accent-brand-600" /> Paid now
          </label>
          {form.markPaid && (
            <Select value={form.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value as PaymentMethod })} className="w-28 py-1.5 text-xs">
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export function LoadingRows({ n = 3 }: { n?: number }) {
  return <div className="space-y-2">{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
}

export const SpinnerIcon = () => <Loader2 className="h-4 w-4 animate-spin" />;
