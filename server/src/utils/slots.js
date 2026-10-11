import Availability from '../models/Availability.js';
import Booking, { ACTIVE_STATUSES } from '../models/Booking.js';
import { toMinutes, fromMinutes, weekdayOf, todayIn, nowMinutesIn } from './time.js';

/**
 * Resolve the working window for a barber on a date.
 * Returns { open:boolean, start:'HH:mm', end:'HH:mm', blocked:string[], reason?:string }
 */
export async function resolveWorkingWindow(barber, date, settings) {
  const override = await Availability.findOne({ barber: barber._id, date }).lean();
  const weekday = weekdayOf(date);

  if (override?.isOff) return { open: false, start: '', end: '', blocked: [], reason: override.note || 'Day off' };
  if (!override && (settings.weeklyOff.includes(weekday) || barber.weeklyOff?.includes(weekday))) {
    return { open: false, start: '', end: '', blocked: [], reason: 'Weekly off' };
  }
  if (!barber.active) return { open: false, start: '', end: '', blocked: [], reason: 'Barber unavailable' };

  const start = override?.start || barber.workingHours?.start || settings.openTime;
  const end = override?.end || barber.workingHours?.end || settings.closeTime;
  return { open: true, start, end, blocked: override?.blockedSlots || [], note: override?.note || '' };
}

/**
 * Build the list of slots for a barber/date given a service duration.
 * Each slot => { time, available, reason }
 */
export async function buildSlots({ barber, date, duration, settings, ignoreBookingId = null, allowPast = false }) {
  const win = await resolveWorkingWindow(barber, date, settings);
  if (!win.open) return { open: false, reason: win.reason, slots: [], window: win };

  const interval = settings.slotInterval || 15;
  const startM = toMinutes(win.start);
  const endM = toMinutes(win.end);

  const bookings = await Booking.find({
    barber: barber._id,
    date,
    status: { $in: ACTIVE_STATUSES },
    ...(ignoreBookingId ? { _id: { $ne: ignoreBookingId } } : {}),
  })
    .select('slotTime duration')
    .lean();

  const busy = bookings.map((b) => {
    const s = toMinutes(b.slotTime);
    return [s, s + b.duration];
  });
  const blocked = new Set(win.blocked);

  const isToday = date === todayIn(settings.timezone);
  const nowM = nowMinutesIn(settings.timezone);

  const slots = [];
  for (let t = startM; t + duration <= endM; t += interval) {
    const tEnd = t + duration;
    let available = true;
    let reason = '';

    if (isToday && !allowPast && t + interval <= nowM) {
      available = false;
      reason = 'past';
    } else if (busy.some(([s, e]) => t < e && tEnd > s)) {
      available = false;
      reason = 'booked';
    } else {
      for (let x = t; x < tEnd; x += interval) {
        if (blocked.has(fromMinutes(x))) {
          available = false;
          reason = 'blocked';
          break;
        }
      }
    }
    slots.push({ time: fromMinutes(t), available, reason });
  }

  return { open: true, slots, window: win };
}

/** Check whether a specific slot is bookable. */
export async function isSlotAvailable(args) {
  const { slots, open, reason } = await buildSlots(args);
  if (!open) return { ok: false, reason: reason || 'closed' };
  const slot = slots.find((s) => s.time === args.slotTime);
  if (!slot) return { ok: false, reason: 'outside working hours' };
  if (!slot.available) return { ok: false, reason: slot.reason };
  return { ok: true };
}
