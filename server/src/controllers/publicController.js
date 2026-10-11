import { z } from 'zod';
import Service from '../models/Service.js';
import Barber from '../models/Barber.js';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/ApiError.js';
import { buildSlots } from '../utils/slots.js';
import { computeQueue } from '../utils/queue.js';
import { todayIn, isValidDate, diffDays, addDays, DATE_RE } from '../utils/time.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const schemas = {
  slotsQuery: z.object({
    barberId: objectId,
    serviceId: objectId,
    date: z.string().regex(DATE_RE, 'Date must be YYYY-MM-DD'),
  }),
  queueQuery: z.object({
    barberId: objectId.optional(),
    date: z.string().regex(DATE_RE).optional(),
  }),
};

export const getSettings = asyncHandler(async (_req, res) => {
  const s = await Settings.get();
  const pub = s.toObject();
  res.json({ success: true, settings: { ...pub, today: todayIn(s.timezone) } });
});

export const listServices = asyncHandler(async (_req, res) => {
  const services = await Service.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();
  res.json({ success: true, services });
});

export const listBarbers = asyncHandler(async (_req, res) => {
  const barbers = await Barber.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();
  res.json({ success: true, barbers });
});

export const getSlots = asyncHandler(async (req, res) => {
  const { barberId, serviceId, date } = req.query;
  const settings = await Settings.get();
  if (!isValidDate(date)) throw badRequest('Invalid date');
  const today = todayIn(settings.timezone);
  const delta = diffDays(today, date);
  if (delta < 0) throw badRequest('Cannot book a past date');
  if (delta > settings.maxAdvanceDays) throw badRequest(`Bookings open only ${settings.maxAdvanceDays} days ahead`);

  const [barber, service] = await Promise.all([Barber.findById(barberId), Service.findById(serviceId)]);
  if (!barber) throw notFound('Barber not found');
  if (!service) throw notFound('Service not found');

  const result = await buildSlots({ barber, date, duration: service.duration, settings });
  res.json({ success: true, date, barberId, serviceId, ...result });
});

/** Public live queue: names + tokens only, no phone numbers. */
export const getQueue = asyncHandler(async (req, res) => {
  const settings = await Settings.get();
  const date = req.query.date || todayIn(settings.timezone);
  let barberId = req.query.barberId;
  if (!barberId) {
    const first = await Barber.findOne({ active: true }).sort({ order: 1 });
    if (!first) return res.json({ success: true, queue: null });
    barberId = String(first._id);
  }
  const queue = await computeQueue(barberId, date);
  res.json({ success: true, queue });
});

/** Dates the user may book (today .. today+maxAdvanceDays). */
export const getBookableDates = asyncHandler(async (_req, res) => {
  const settings = await Settings.get();
  const today = todayIn(settings.timezone);
  const dates = [];
  for (let i = 0; i <= settings.maxAdvanceDays; i++) dates.push(addDays(today, i));
  res.json({ success: true, today, dates });
});
