import { z } from 'zod';
import Booking, { BOOKING_STATUSES, ACTIVE_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../models/Booking.js';
import Barber from '../models/Barber.js';
import Service from '../models/Service.js';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/ApiError.js';
import { computeQueue } from '../utils/queue.js';
import { isSlotAvailable } from '../utils/slots.js';
import { todayIn, DATE_RE, TIME_RE } from '../utils/time.js';
import { createBookingRecord } from './bookingController.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const schemas = {
  listQuery: z.object({
    date: z.string().regex(DATE_RE).optional(),
    from: z.string().regex(DATE_RE).optional(),
    to: z.string().regex(DATE_RE).optional(),
    barberId: objectId.optional(),
    status: z.enum(BOOKING_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    search: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  }),
  create: z.object({
    barberId: objectId,
    serviceId: objectId,
    date: z.string().regex(DATE_RE),
    slotTime: z.string().regex(TIME_RE),
    customerName: z.string().trim().min(2).max(80),
    customerPhone: z.string().trim().max(15).optional().default(''),
    userId: objectId.optional(),
    notes: z.string().trim().max(300).optional(),
    source: z.enum(['admin', 'walk_in']).default('walk_in'),
    markPaid: z.boolean().optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  }),
  status: z.object({ status: z.enum(BOOKING_STATUSES), reason: z.string().trim().max(200).optional() }),
  payment: z.object({
    status: z.enum(PAYMENT_STATUSES),
    method: z.enum(PAYMENT_METHODS).nullable().optional(),
    amount: z.coerce.number().min(0).optional(),
    reference: z.string().trim().max(80).optional(),
  }),
  reschedule: z.object({
    barberId: objectId.optional(),
    date: z.string().regex(DATE_RE).optional(),
    slotTime: z.string().regex(TIME_RE).optional(),
    serviceId: objectId.optional(),
    notes: z.string().trim().max(300).optional(),
  }),
  queueQuery: z.object({ barberId: objectId, date: z.string().regex(DATE_RE).optional() }),
};

const populate = (q) => q.populate('barber', 'name avatar').populate('service', 'name').populate('user', 'name email phone');

export const listBookings = asyncHandler(async (req, res) => {
  const { date, from, to, barberId, status, paymentStatus, search, page, limit } = req.query;
  const filter = {};
  if (date) filter.date = date;
  else if (from || to) filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (barberId) filter.barber = barberId;
  if (status) filter.status = status;
  if (paymentStatus) filter['payment.status'] = paymentStatus;
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const asNumber = Number(search);
    filter.$or = [{ customerName: rx }, { customerPhone: rx }, ...(Number.isFinite(asNumber) ? [{ tokenNumber: asNumber }] : [])];
  }
  const [bookings, total] = await Promise.all([
    populate(Booking.find(filter).sort({ date: -1, slotTime: 1, tokenNumber: 1 }).skip((page - 1) * limit).limit(limit)).lean(),
    Booking.countDocuments(filter),
  ]);
  res.json({ success: true, bookings, total, page, limit });
});

export const adminQueue = asyncHandler(async (req, res) => {
  const settings = await Settings.get();
  const date = req.query.date || todayIn(settings.timezone);
  const queue = await computeQueue(req.query.barberId, date, { includePrivate: true });
  res.json({ success: true, queue });
});

export const createForClient = asyncHandler(async (req, res) => {
  const { barberId, serviceId, date, slotTime, customerName, customerPhone, userId, notes, source, markPaid, paymentMethod } = req.body;
  const { booking } = await createBookingRecord({
    user: userId ? { _id: userId, name: customerName, phone: customerPhone } : null,
    createdBy: req.user._id,
    barberId, serviceId, date, slotTime, customerName, customerPhone, notes, source,
    isAdmin: true,
    payment: markPaid ? { status: 'paid', method: paymentMethod || 'cash', paidAt: new Date() } : undefined,
  });
  const full = await populate(Booking.findById(booking._id)).lean();
  res.status(201).json({ success: true, booking: full });
});

async function applyStatus(booking, status, reason = '') {
  const now = new Date();
  if (status === 'serving') {
    // Only one client in the chair per barber: finish whoever is currently serving
    await Booking.updateMany(
      { barber: booking.barber, date: booking.date, status: 'serving', _id: { $ne: booking._id } },
      { $set: { status: 'done', completedAt: now } },
    );
    booking.servedAt = now;
  }
  if (status === 'done') booking.completedAt = now;
  if (status === 'cancelled' || status === 'no_show') {
    booking.cancelledAt = now;
    booking.cancelledBy = 'admin';
    booking.cancelReason = reason;
  }
  if (status === 'waiting') {
    booking.servedAt = undefined;
    booking.completedAt = undefined;
    booking.cancelledAt = undefined;
    booking.cancelledBy = null;
  }
  booking.status = status;
  await booking.save();
}

export const updateStatus = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw notFound('Booking not found');
  await applyStatus(booking, req.body.status, req.body.reason);
  res.json({ success: true, booking: await populate(Booking.findById(booking._id)).lean() });
});

/** Finish the current client (if any) and move the next waiting client into the chair. */
export const callNext = asyncHandler(async (req, res) => {
  const settings = await Settings.get();
  const date = req.body.date || todayIn(settings.timezone);
  const barberId = req.params.barberId;
  const queue = await computeQueue(barberId, date, { includePrivate: true });
  if (queue.serving) {
    const cur = await Booking.findById(queue.serving.id);
    await applyStatus(cur, 'done');
  }
  if (queue.waiting[0]) {
    const next = await Booking.findById(queue.waiting[0].id);
    await applyStatus(next, 'serving');
  }
  res.json({ success: true, queue: await computeQueue(barberId, date, { includePrivate: true }) });
});

/** Permanently remove a booking (frees its slot and token). Use cancel/no-show to keep history. */
export const deleteBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw notFound('Booking not found');
  await booking.deleteOne();
  res.json({ success: true });
});

export const updatePayment = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw notFound('Booking not found');
  const { status, method, amount, reference } = req.body;
  booking.payment.status = status;
  if (method !== undefined) booking.payment.method = method;
  if (amount !== undefined) booking.payment.amount = amount;
  if (reference !== undefined) booking.payment.reference = reference;
  booking.payment.paidAt = status === 'paid' ? new Date() : undefined;
  await booking.save();
  res.json({ success: true, booking: await populate(Booking.findById(booking._id)).lean() });
});
