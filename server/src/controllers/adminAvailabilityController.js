import { z } from 'zod';
import Availability from '../models/Availability.js';
import Barber from '../models/Barber.js';
import Booking, { ACTIVE_STATUSES } from '../models/Booking.js';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound, badRequest } from '../utils/ApiError.js';
import { resolveWorkingWindow, buildSlots } from '../utils/slots.js';
import { DATE_RE, TIME_RE, dayjs, addDays, toMinutes } from '../utils/time.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const schemas = {
  monthQuery: z.object({
    barberId: objectId,
    month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
  }),
  dayQuery: z.object({ barberId: objectId, date: z.string().regex(DATE_RE) }),
  upsert: z.object({
    barberId: objectId,
    date: z.string().regex(DATE_RE),
    isOff: z.boolean().optional(),
    start: z.string().regex(TIME_RE).or(z.literal('')).optional(),
    end: z.string().regex(TIME_RE).or(z.literal('')).optional(),
    blockedSlots: z.array(z.string().regex(TIME_RE)).optional(),
    note: z.string().trim().max(200).optional(),
  }),
  bulkOff: z.object({
    barberId: objectId,
    dates: z.array(z.string().regex(DATE_RE)).min(1).max(62),
    isOff: z.boolean(),
    note: z.string().trim().max(200).optional(),
  }),
};

/** Month overview: for each day => open/off, booking counts. */
export const monthOverview = asyncHandler(async (req, res) => {
  const { barberId, month } = req.query;
  const barber = await Barber.findById(barberId);
  if (!barber) throw notFound('Barber not found');
  const settings = await Settings.get();
  const first = `${month}-01`;
  const daysInMonth = dayjs(first, 'YYYY-MM-DD').daysInMonth();
  const last = addDays(first, daysInMonth - 1);

  const [overrides, counts] = await Promise.all([
    Availability.find({ barber: barberId, date: { $gte: first, $lte: last } }).lean(),
    Booking.aggregate([
      { $match: { barber: barber._id, date: { $gte: first, $lte: last } } },
      { $group: { _id: '$date', active: { $sum: { $cond: [{ $in: ['$status', ACTIVE_STATUSES] }, 1, 0] } }, total: { $sum: 1 } } },
    ]),
  ]);
  const ovMap = Object.fromEntries(overrides.map((o) => [o.date, o]));
  const cMap = Object.fromEntries(counts.map((c) => [c._id, c]));

  const days = [];
  for (let i = 0; i < daysInMonth; i++) {
    const date = addDays(first, i);
    const win = await resolveWorkingWindow(barber, date, settings);
    days.push({
      date,
      open: win.open,
      start: win.start,
      end: win.end,
      reason: win.reason || '',
      blocked: win.blocked?.length || 0,
      hasOverride: Boolean(ovMap[date]),
      activeBookings: cMap[date]?.active || 0,
      totalBookings: cMap[date]?.total || 0,
    });
  }
  res.json({ success: true, month, days, defaults: { openTime: settings.openTime, closeTime: settings.closeTime, interval: settings.slotInterval } });
});

/** Single day detail: override + the slot grid (using the salon interval as the unit). */
export const dayDetail = asyncHandler(async (req, res) => {
  const { barberId, date } = req.query;
  const barber = await Barber.findById(barberId);
  if (!barber) throw notFound('Barber not found');
  const settings = await Settings.get();
  const override = await Availability.findOne({ barber: barberId, date }).lean();
  const grid = await buildSlots({ barber, date, duration: settings.slotInterval, settings, allowPast: true });
  const bookings = await Booking.find({ barber: barberId, date, status: { $in: ACTIVE_STATUSES } })
    .select('customerName slotTime duration tokenNumber status serviceName')
    .lean();
  res.json({ success: true, date, override, window: grid.window, open: grid.open, reason: grid.reason, slots: grid.slots, bookings });
});

export const upsertDay = asyncHandler(async (req, res) => {
  const { barberId, date, ...data } = req.body;
  if (!(await Barber.exists({ _id: barberId }))) throw notFound('Barber not found');
  if (data.start && data.end && toMinutes(data.start) >= toMinutes(data.end)) throw badRequest('Start must be before end');
  const doc = await Availability.findOneAndUpdate(
    { barber: barberId, date },
    { $set: data },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  const affected = data.isOff ? await Booking.countDocuments({ barber: barberId, date, status: { $in: ACTIVE_STATUSES } }) : 0;
  res.json({ success: true, availability: doc, affectedBookings: affected });
});

export const bulkOff = asyncHandler(async (req, res) => {
  const { barberId, dates, isOff, note = '' } = req.body;
  if (!(await Barber.exists({ _id: barberId }))) throw notFound('Barber not found');
  await Availability.bulkWrite(
    dates.map((date) => ({
      updateOne: { filter: { barber: barberId, date }, update: { $set: { isOff, note } }, upsert: true },
    })),
  );
  res.json({ success: true, updated: dates.length });
});

export const clearDay = asyncHandler(async (req, res) => {
  await Availability.deleteOne({ barber: req.query.barberId, date: req.query.date });
  res.json({ success: true });
});
