import Booking, { ACTIVE_STATUSES } from '../models/Booking.js';
import Settings from '../models/Settings.js';
import { nowMinutesIn, minutesOfDateIn, toMinutes, fromMinutes } from './time.js';

const sortQueue = (a, b) =>
  a.slotTime === b.slotTime ? a.tokenNumber - b.tokenNumber : a.slotTime.localeCompare(b.slotTime);

/**
 * Compute the live queue for a barber on a date.
 * Returns { serving, waiting:[...with position/eta], finished:[...] }
 */
export async function computeQueue(barberId, date, { includePrivate = false } = {}) {
  const settings = await Settings.get();
  const tz = settings.timezone;
  const rows = await Booking.find({ barber: barberId, date }).lean();

  const active = rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).sort(sortQueue);
  const serving = active.find((r) => r.status === 'serving') || null;
  const waiting = active.filter((r) => r.status === 'waiting');
  const finished = rows.filter((r) => !ACTIVE_STATUSES.includes(r.status)).sort(sortQueue);

  const nowM = nowMinutesIn(tz);

  let cursor = nowM;
  let servingRemaining = 0;
  if (serving) {
    const startedM = serving.servedAt ? minutesOfDateIn(serving.servedAt, tz) : toMinutes(serving.slotTime);
    servingRemaining = Math.max(0, startedM + serving.duration - nowM);
    cursor = nowM + servingRemaining;
  }

  const shape = (b) => ({
    id: b._id,
    tokenNumber: b.tokenNumber,
    customerName: b.customerName,
    customerPhone: includePrivate ? b.customerPhone : undefined,
    userId: b.user || null,
    serviceName: b.serviceName,
    price: b.price,
    duration: b.duration,
    slotTime: b.slotTime,
    status: b.status,
    payment: includePrivate ? b.payment : { status: b.payment?.status },
    source: b.source,
    notes: includePrivate ? b.notes : undefined,
    servedAt: b.servedAt,
    completedAt: b.completedAt,
  });

  const waitingShaped = waiting.map((b, idx) => {
    const slotM = toMinutes(b.slotTime);
    const start = Math.max(cursor, slotM);
    const waitMinutes = Math.max(0, start - nowM);
    cursor = start + b.duration;
    return { ...shape(b), position: idx + 1, clientsAhead: idx, estimatedStart: fromMinutes(start), waitMinutes };
  });

  return {
    date,
    barberId: String(barberId),
    now: fromMinutes(nowM),
    serving: serving ? { ...shape(serving), remainingMinutes: servingRemaining } : null,
    waiting: waitingShaped,
    finished: finished.map(shape),
    totalWaitMinutes: waitingShaped.length ? Math.max(0, cursor - nowM) : servingRemaining,
  };
}

/** Next token number for a date (per-day numbering). */
export async function nextTokenNumber(date, tokenStart) {
  const last = await Booking.findOne({ date }).sort({ tokenNumber: -1 }).select('tokenNumber').lean();
  return last ? last.tokenNumber + 1 : tokenStart;
}
