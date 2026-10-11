import { z } from 'zod';
import Booking, { ACTIVE_STATUSES } from '../models/Booking.js';
import Barber from '../models/Barber.js';
import Service from '../models/Service.js';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound, forbidden } from '../utils/ApiError.js';
import { isSlotAvailable } from '../utils/slots.js';
import { computeQueue, nextTokenNumber } from '../utils/queue.js';
import { todayIn, isValidDate, diffDays, DATE_RE, TIME_RE } from '../utils/time.js';
import { sendMail, bookingConfirmedTemplate } from '../utils/mailer.js';
import { notifyAdminsAsync } from '../utils/notify.js';

const fmt12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const bookingUrl = (b) => `/admin/bookings?date=${b.date}&q=${encodeURIComponent(b.customerName)}`;

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const schemas = {
  create: z.object({
    barberId: objectId,
    serviceId: objectId,
    date: z.string().regex(DATE_RE, 'Date must be YYYY-MM-DD'),
    slotTime: z.string().regex(TIME_RE, 'Slot must be HH:mm'),
    customerName: z.string().trim().min(2).max(80).optional(),
    customerPhone: z.string().trim().max(15).optional(),
    notes: z.string().trim().max(300).optional(),
  }),
  cancel: z.object({ reason: z.string().trim().max(200).optional() }),
  claim: z.object({
    method: z.enum(['upi']).default('upi'),
    reference: z.string().trim().min(4, 'Enter the UPI transaction / UTR number').max(40),
  }),
};

/** Shared booking creation for user and admin flows (validation, slot check, token numbering). */
export async function createBookingRecord(opts) {
  const { user, createdBy, barberId, serviceId, date, slotTime, customerName, customerPhone } = opts;
  const { notes = '', source = 'online', isAdmin = false, payment } = opts;

  const settings = await Settings.get();
  if (!isValidDate(date)) throw badRequest('Invalid date');
  const today = todayIn(settings.timezone);
  const delta = diffDays(today, date);
  if (delta < 0) throw badRequest('Cannot book a past date');
  if (!isAdmin && delta > settings.maxAdvanceDays) throw badRequest(`Bookings open only ${settings.maxAdvanceDays} days ahead`);
  if (!isAdmin && !settings.allowOnlineBooking) throw badRequest('Online booking is paused. Please call the salon.');

  const [barber, service] = await Promise.all([Barber.findById(barberId), Service.findById(serviceId)]);
  if (!barber || (!isAdmin && !barber.active)) throw notFound('Barber not found');
  if (!service || (!isAdmin && !service.active)) throw notFound('Service not found');

  if (!isAdmin && user) {
    const activeCount = await Booking.countDocuments({ user: user._id, status: { $in: ACTIVE_STATUSES }, date: { $gte: today } });
    if (activeCount >= settings.maxActiveBookingsPerUser) {
      throw badRequest(
        activeCount === 1
          ? 'You already have an upcoming booking. Cancel it from Live Queue if you want to book a different slot.'
          : `You already have ${activeCount} upcoming bookings. Cancel one from Live Queue to book again.`,
      );
    }
  }

  const check = await isSlotAvailable({ barber, date, slotTime, duration: service.duration, settings, allowPast: isAdmin });
  if (!check.ok) {
    const map = { past: 'That time has already passed', booked: 'That slot was just taken, pick another', blocked: 'That slot is blocked by the barber' };
    throw badRequest(map[check.reason] || `Slot not available (${check.reason})`);
  }

  const base = {
    user: user?._id || null,
    createdBy: createdBy || user?._id || null,
    customerName: customerName || user?.name,
    customerPhone: customerPhone ?? user?.phone ?? '',
    barber: barber._id,
    service: service._id,
    serviceName: service.name,
    price: service.price,
    duration: service.duration,
    date,
    slotTime,
    notes,
    source,
    payment: { status: 'pending', method: null, amount: service.price, ...(payment || {}) },
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const tokenNumber = await nextTokenNumber(date, settings.tokenStart);
    try {
      const booking = await Booking.create({ ...base, tokenNumber });
      return { booking, barber, service, settings };
    } catch (err) {
      if (err.code !== 11000 || attempt === 4) throw err;
    }
  }
  throw badRequest('Could not allocate a token, please retry');
}

const populateBooking = (q) => q.populate('barber', 'name avatar').populate('service', 'name');

export const createBooking = asyncHandler(async (req, res) => {
  const { barberId, serviceId, date, slotTime, customerName, customerPhone, notes } = req.body;
  if (!req.user.phone && !customerPhone) throw badRequest('Please add your mobile number');

  const { booking, barber, settings } = await createBookingRecord({
    user: req.user, barberId, serviceId, date, slotTime, notes, source: 'online',
    customerName: customerName || req.user.name,
    customerPhone: customerPhone || req.user.phone,
  });
  if (customerPhone && !req.user.phone) {
    req.user.phone = customerPhone;
    await req.user.save();
  }

  sendMail({
    to: req.user.email,
    ...bookingConfirmedTemplate({
      name: req.user.name, tokenNumber: booking.tokenNumber, serviceName: booking.serviceName,
      date, slotTime, barberName: barber.name, salonName: settings.salonName,
    }),
  }).catch((e) => console.warn('[mail] booking confirmation failed:', e.message));

  notifyAdminsAsync({
    type: 'booking_created',
    title: `New booking #${booking.tokenNumber} - ${booking.customerName}`,
    body: `${booking.serviceName} with ${barber.name}, ${date === todayIn(settings.timezone) ? 'today' : date} at ${fmt12(slotTime)}`,
    data: { bookingId: booking._id, tokenNumber: booking.tokenNumber, date, barberId: barber._id, url: bookingUrl(booking), tag: `booking-${booking._id}` },
  });

  const full = await populateBooking(Booking.findById(booking._id));
  res.status(201).json({ success: true, booking: full });
});

export const myBookings = asyncHandler(async (req, res) => {
  const settings = await Settings.get();
  const today = todayIn(settings.timezone);
  const bookings = await populateBooking(Booking.find({ user: req.user._id }).sort({ date: -1, slotTime: -1 }).limit(100)).lean();
  const upcoming = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status) && b.date >= today);
  const past = bookings.filter((b) => !upcoming.includes(b));
  res.json({ success: true, today, upcoming, past });
});

export const getBooking = asyncHandler(async (req, res) => {
  const booking = await populateBooking(Booking.findById(req.params.id)).lean();
  if (!booking) throw notFound('Booking not found');
  if (req.user.role !== 'admin' && String(booking.user) !== String(req.user._id)) throw forbidden();
  let position = null;
  if (booking.status === 'waiting') {
    const queue = await computeQueue(booking.barber._id, booking.date);
    position = queue.waiting.find((w) => String(w.id) === String(booking._id)) || null;
  }
  res.json({ success: true, booking, position });
});

/** Client reports a UPI payment (no gateway): stores the reference, admin confirms later. */
export const claimPayment = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw notFound('Booking not found');
  if (String(booking.user) !== String(req.user._id)) throw forbidden();
  if (['cancelled', 'no_show'].includes(booking.status)) throw badRequest('This booking is not active');
  if (booking.payment.status === 'paid') throw badRequest('This booking is already paid');
  booking.payment.status = 'verifying';
  booking.payment.method = req.body.method;
  booking.payment.reference = req.body.reference;
  booking.payment.claimedAt = new Date();
  if (!booking.payment.amount) booking.payment.amount = booking.price;
  await booking.save();
  notifyAdminsAsync({
    type: 'payment_claimed',
    title: `UPI payment to verify - #${booking.tokenNumber} ${booking.customerName}`,
    body: `Says paid ${booking.payment.amount} via UPI, ref ${booking.payment.reference}. Confirm from the booking.`,
    data: { bookingId: booking._id, tokenNumber: booking.tokenNumber, date: booking.date, url: bookingUrl(booking), tag: `payment-${booking._id}` },
  });
  const full = await populateBooking(Booking.findById(booking._id)).lean();
  res.json({ success: true, booking: full });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw notFound('Booking not found');
  if (String(booking.user) !== String(req.user._id)) throw forbidden();
  if (booking.status !== 'waiting') throw badRequest('Only waiting bookings can be cancelled');
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledBy = 'user';
  booking.cancelReason = req.body.reason || '';
  await booking.save();
  notifyAdminsAsync({
    type: 'booking_cancelled',
    title: `Cancelled #${booking.tokenNumber} - ${booking.customerName}`,
    body: `${booking.serviceName}, ${booking.date} at ${fmt12(booking.slotTime)}${booking.cancelReason ? ` - "${booking.cancelReason}"` : ''}. Slot is free again.`,
    data: { bookingId: booking._id, tokenNumber: booking.tokenNumber, date: booking.date, barberId: booking.barber, url: bookingUrl(booking), tag: `booking-${booking._id}` },
  });
  res.json({ success: true, booking });
});
