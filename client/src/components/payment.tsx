'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, ExternalLink, Smartphone, Store, Wallet, BadgeCheck, Clock3 } from 'lucide-react';
import { Button, Field, Input, Sheet } from './ui';
import { useToast } from './toast';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings-context';
import { buildUpiLink, copyText, isUpiEnabled } from '@/lib/upi';
import type { Booking, Payment } from '@/lib/types';
import { cn, money } from '@/lib/utils';

export type PayChoice = 'salon' | 'upi';

/** Radio-style choice shown on the booking form. */
export function PaymentChoice({ value, onChange, amount }: { value: PayChoice; onChange: (v: PayChoice) => void; amount: number }) {
  const { settings } = useSettings();
  const upi = isUpiEnabled(settings);
  const opts: { value: PayChoice; title: string; text: string; icon: any; disabled?: boolean }[] = [
    { value: 'salon', title: 'Pay at salon', text: 'Cash or UPI at the counter after your service', icon: Store },
    { value: 'upi', title: 'Pay now via UPI', text: upi ? `Send ${money(amount)} to ${settings.upiId} from any UPI app` : 'Not available yet', icon: Smartphone, disabled: !upi },
  ];
  return (
    <div className="grid grid-cols-1 gap-2">
      {opts.map((o) => {
        const sel = value === o.value;
        return (
          <button key={o.value} type="button" disabled={o.disabled} onClick={() => onChange(o.value)} className={cn('flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50', sel ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : 'border-slate-200 bg-slate-50')}>
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', sel ? 'bg-brand-600 text-white' : 'bg-white text-slate-500')}>
              <o.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-900">{o.title}</span>
              <span className="block truncate text-[11px] text-slate-500">{o.text}</span>
            </span>
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border', sel ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white')}>{sel && <Check className="h-3 w-3" />}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Small status pill for a booking's payment. */
export function PayBadge({ payment, className }: { payment: Partial<Payment>; className?: string }) {
  const s = payment?.status || 'pending';
  const map = {
    pending: { icon: Wallet, text: 'Pay at salon', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    verifying: { icon: Clock3, text: 'UPI sent, verifying', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    paid: { icon: BadgeCheck, text: `Paid${payment.method ? ` via ${payment.method.toUpperCase()}` : ''}`, cls: 'bg-brand-50 text-brand-700 border-brand-200' },
    refunded: { icon: Wallet, text: 'Refunded', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  } as const;
  const m = map[s];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', m.cls, className)}>
      <m.icon className="h-3 w-3" /> {m.text}
    </span>
  );
}

/**
 * UPI payment sheet without a gateway:
 * QR + "open UPI app" deep link with the amount prefilled, then the client submits the UPI reference (UTR).
 */
export function UpiPaySheet({ booking, open, onClose, onClaimed }: { booking: Booking | null; open: boolean; onClose: () => void; onClaimed: (b: Booking) => void }) {
  const { settings } = useSettings();
  const toast = useToast();
  const [qr, setQr] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const amount = booking ? booking.payment?.amount || booking.price : 0;
  const link = booking ? buildUpiLink({ pa: settings.upiId || '', pn: settings.salonName, am: amount, tn: `Token ${booking.tokenNumber} ${booking.serviceName}`, tr: `T${booking.tokenNumber}${booking.date.replace(/-/g, '')}` }) : '';

  useEffect(() => {
    if (!open || !link) return;
    setRef('');
    setCopied(false);
    QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [open, link]);

  const submit = async () => {
    if (!booking) return;
    const clean = ref.trim();
    if (clean.length < 4) return toast.error('Enter the UPI transaction ID / UTR shown in your payment app');
    setBusy(true);
    try {
      const r = await api<{ booking: Booking }>(`/bookings/${booking._id}/payment-claim`, { method: 'PATCH', body: { method: 'upi', reference: clean } });
      toast.success('Payment details sent. The barber will confirm it.');
      onClaimed(r.booking);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (await copyText(settings.upiId || '')) {
      setCopied(true);
      toast.success('UPI ID copied');
    }
  };

  return (
    <Sheet open={open && Boolean(booking)} onClose={onClose} title={booking ? `Pay ${money(amount)} via UPI` : 'Pay via UPI'} footer={<Button className="w-full" loading={busy} onClick={submit}><BadgeCheck className="h-4 w-4" /> I have paid, submit reference</Button>}>
      {booking && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-600">
            Token <b className="text-slate-900">#{booking.tokenNumber}</b> &bull; {booking.serviceName} &bull; <b className="text-brand-700">{money(amount)}</b>
          </div>

          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">1</span>
              <div className="flex-1">
                <p className="font-bold text-slate-900">Pay from any UPI app</p>
                <p className="text-xs text-slate-500">Scan the QR with another phone, or tap the button to open GPay / PhonePe / Paytm on this phone.</p>
                {qr && (
                  <div className="mx-auto mt-3 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="UPI QR code" className="h-full w-full" />
                  </div>
                )}
                <a href={link} className="btn-primary mt-3 w-full"><Smartphone className="h-4 w-4" /> Open UPI app &bull; {money(amount)}</a>
                <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase text-slate-400">UPI ID</p>
                    <p className="truncate font-mono text-sm font-bold text-slate-900">{settings.upiId}</p>
                  </div>
                  <button onClick={copy} className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                    {copied ? <Check className="h-3.5 w-3.5 text-brand-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">2</span>
              <div className="flex-1">
                <p className="font-bold text-slate-900">Enter the transaction ID</p>
                <p className="text-xs text-slate-500">Found on the payment success screen as UPI Ref / UTR (12 digits). The barber matches it with the bank SMS.</p>
                <Field className="mt-2">
                  <Input inputMode="numeric" autoComplete="off" placeholder="e.g. 329814567890" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={40} />
                </Field>
              </div>
            </li>
          </ol>
          <p className="flex items-center gap-1 text-[11px] text-slate-400"><ExternalLink className="h-3 w-3" /> No payment gateway is used. Money goes directly to the salon&apos;s UPI account.</p>
        </div>
      )}
    </Sheet>
  );
}
