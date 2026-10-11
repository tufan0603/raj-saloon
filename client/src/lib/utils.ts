import clsx, { type ClassValue } from 'clsx';
import dayjs from 'dayjs';
import type { BookingStatus, PaymentStatus } from './types';

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export const CURRENCY = '₹';
export const money = (n: number | undefined | null) => `${CURRENCY}${Math.round(n || 0).toLocaleString('en-IN')}`;

/** "14:05" -> "2:05 PM" */
export function fmtTime(hhmm?: string) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${suffix}`;
}

export const todayStr = () => dayjs().format('YYYY-MM-DD');
export const addDaysStr = (date: string, n: number) => dayjs(date).add(n, 'day').format('YYYY-MM-DD');

/** "2026-10-11" -> "Today" | "Tomorrow" | "Sat, 11 Oct" */
export function fmtDate(date: string, today = todayStr(), opts: { relative?: boolean; long?: boolean } = { relative: true }) {
  if (opts.relative) {
    if (date === today) return 'Today';
    if (date === addDaysStr(today, 1)) return 'Tomorrow';
    if (date === addDaysStr(today, -1)) return 'Yesterday';
  }
  return dayjs(date).format(opts.long ? 'dddd, D MMMM YYYY' : 'ddd, D MMM');
}

export const fmtDateTime = (iso?: string) => (iso ? dayjs(iso).format('D MMM, h:mm A') : '');
export const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${m}m`);

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export const STATUS_LABEL: Record<BookingStatus, string> = {
  waiting: 'Waiting',
  serving: 'In Chair',
  done: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export const STATUS_CLASS: Record<BookingStatus, string> = {
  waiting: 'bg-amber-100 text-amber-800',
  serving: 'bg-brand-600 text-white',
  done: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-50 text-red-600',
  no_show: 'bg-orange-50 text-orange-700',
};

export const PAY_LABEL: Record<PaymentStatus, string> = { pending: 'Unpaid', verifying: 'UPI - verify', paid: 'Paid', refunded: 'Refunded' };
export const PAY_CLASS: Record<PaymentStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  verifying: 'bg-sky-50 text-sky-700 border-sky-200',
  paid: 'bg-brand-50 text-brand-700 border-brand-200',
  refunded: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const idOf = (x: any): string => (typeof x === 'string' ? x : x?._id || x?.id || '');
export const nameOf = (x: any, fallback = ''): string => (typeof x === 'object' && x ? x.name : fallback);

export function waLink(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, '');
  const num = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${num}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export const vibrate = (ms = 15) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};
