'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Ticket, Phone } from 'lucide-react';
import { AppShell, RequireAuth } from '@/components/shell';
import { BarberPicker, DateStrip, ServicePicker, SlotGrid, TokenSuccess } from '@/components/booking';
import { PaymentChoice, UpiPaySheet, type PayChoice } from '@/components/payment';
import { isUpiEnabled } from '@/lib/upi';
import { Button, Field, Input, Skeleton, Textarea } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import type { Barber, Booking, Service, SlotsResponse } from '@/lib/types';
import { fmtDate, fmtTime, money, vibrate } from '@/lib/utils';

function BookingForm() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const { settings } = useSettings();

  const barbers = useAsync(() => api<{ barbers: Barber[] }>('/barbers').then((r) => r.barbers), [], { cacheKey: 'barbers' });
  const services = useAsync(() => api<{ services: Service[] }>('/services').then((r) => r.services), [], { cacheKey: 'services' });
  const dates = useAsync(() => api<{ today: string; dates: string[] }>('/dates'), [], { cacheKey: 'dates' });

  const [barberId, setBarberId] = useState(params.get('barberId') || '');
  const [serviceId, setServiceId] = useState(params.get('serviceId') || '');
  const [date, setDate] = useState('');
  const [slotTime, setSlotTime] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<SlotsResponse | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Booking | null>(null);
  const [payChoice, setPayChoice] = useState<PayChoice>('salon');
  const [payOpen, setPayOpen] = useState(false);
  const upiEnabled = isUpiEnabled(settings);

  // defaults once data arrives
  useEffect(() => {
    if (barbers.data?.length && !barbers.data.some((b) => b._id === barberId)) setBarberId(barbers.data[0]._id);
  }, [barbers.data, barberId]);
  useEffect(() => {
    if (services.data?.length && !services.data.some((s) => s._id === serviceId)) setServiceId((services.data.find((s) => s.popular) || services.data[0])._id);
  }, [services.data, serviceId]);
  useEffect(() => {
    if (dates.data && !date) setDate(dates.data.today);
  }, [dates.data, date]);

  // load slots
  useEffect(() => {
    if (!barberId || !serviceId || !date) return;
    const ctrl = new AbortController();
    setSlotsLoading(true);
    api<SlotsResponse>('/slots', { query: { barberId, serviceId, date }, signal: ctrl.signal })
      .then((r) => {
        setSlots(r);
        setSlotTime((cur) => (r.slots.find((s) => s.time === cur && s.available) ? cur : r.slots.find((s) => s.available)?.time || ''));
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') toast.error(e.message);
      })
      .finally(() => setSlotsLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberId, serviceId, date]);

  const service = useMemo(() => services.data?.find((s) => s._id === serviceId), [services.data, serviceId]);
  const barber = useMemo(() => barbers.data?.find((b) => b._id === barberId), [barbers.data, barberId]);
  const today = dates.data?.today;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotTime) return toast.error('Pick an available time slot');
    if (!user?.phone && !/^\d{10}$/.test(phone.replace(/\D/g, ''))) return toast.error('Enter a valid 10-digit mobile number');
    setBusy(true);
    try {
      const res = await api<{ booking: Booking }>('/bookings', { body: { barberId, serviceId, date, slotTime, customerPhone: phone || undefined, notes: notes || undefined } });
      vibrate(30);
      setCreated(res.booking);
      if (user && !user.phone && phone) setUser({ ...user, phone });
    } catch (err: any) {
      toast.error(err.message);
      if (err.status === 400) {
        // refresh slots in case it was just taken
        api<SlotsResponse>('/slots', { query: { barberId, serviceId, date } }).then(setSlots).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  const loading = barbers.loading || services.loading || dates.loading;

  return (
    <AppShell nav="user" title="Book Your Slot" subtitle="Fast token generation & live turn tracking" back="/">
      {!settings.allowOnlineBooking && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">Online booking is paused right now. Please call the salon.</div>
      )}
      <form onSubmit={submit} className="card space-y-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-40" />
            <Skeleton className="h-16" />
          </div>
        ) : (
          <>
            {!user?.phone && (
              <Field label="Mobile number" hint="Saved to your profile for future bookings.">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input type="tel" inputMode="numeric" maxLength={10} required placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-9" />
                </div>
              </Field>
            )}

            <Field label="Select barber">{barbers.data?.length ? <BarberPicker barbers={barbers.data} value={barberId} onChange={setBarberId} /> : <p className="text-xs text-slate-400">No barbers available.</p>}</Field>

            <Field label="Select service">{services.data?.length ? <ServicePicker services={services.data} value={serviceId} onChange={setServiceId} /> : <p className="text-xs text-slate-400">No services available.</p>}</Field>

            <Field label="Date">{dates.data && <DateStrip dates={dates.data.dates} value={date} onChange={setDate} today={dates.data.today} />}</Field>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Available slot{barber ? ` with ${barber.name}` : ''}</label>
                <span className="text-[11px] font-semibold text-brand-600">{slotTime ? fmtTime(slotTime) : 'Select a time'}</span>
              </div>
              {slotsLoading && !slots ? (
                <Skeleton className="h-24" />
              ) : slots ? (
                <div className={slotsLoading ? 'opacity-60' : ''}>
                  <SlotGrid slots={slots.slots} value={slotTime} onChange={(t) => { setSlotTime(t); vibrate(); }} open={slots.open} reason={slots.reason} />
                </div>
              ) : null}
            </div>

            <Field label="Note for the barber (optional)">
              <Textarea placeholder="e.g. Fade on sides, keep top long" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} className="min-h-[64px]" />
            </Field>

            <Field label="Payment">
              <PaymentChoice value={payChoice} onChange={setPayChoice} amount={service?.price || 0} />
            </Field>

            <div className="flex items-center justify-between rounded-xl bg-slate-100 p-3 text-xs">
              <div>
                <span className="block text-slate-500">Service time</span>
                <span className="font-bold text-slate-800">{service ? `${service.duration} mins` : '-'}</span>
                {date && today && slotTime && <span className="block text-[11px] text-slate-500">{fmtDate(date, today)} &bull; {fmtTime(slotTime)}</span>}
              </div>
              <div className="text-right">
                <span className="block text-slate-500">{payChoice === 'upi' && upiEnabled ? 'Pay via UPI after token' : 'Pay at salon'}</span>
                <span className="text-base font-extrabold text-brand-600">{service ? money(service.price) : '-'}</span>
              </div>
            </div>

            <Button type="submit" className="w-full py-3" loading={busy} disabled={!slotTime || !settings.allowOnlineBooking}>
              <Ticket className="h-4 w-4" /> Confirm & Generate Token
            </Button>
          </>
        )}
      </form>

      <TokenSuccess
        booking={created}
        barberName={barber?.name}
        onClose={() => { setCreated(null); router.push('/dashboard'); }}
        onPay={upiEnabled && payChoice === 'upi' ? () => setPayOpen(true) : undefined}
      />
      <UpiPaySheet
        booking={created}
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onClaimed={(b) => { setCreated(b); setPayOpen(false); router.push('/dashboard'); }}
      />
    </AppShell>
  );
}

export default function BookPage() {
  return (
    <RequireAuth>
      <Suspense>
        <BookingForm />
      </Suspense>
    </RequireAuth>
  );
}
