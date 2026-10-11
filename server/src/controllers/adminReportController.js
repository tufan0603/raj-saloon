import Booking, { ACTIVE_STATUSES } from '../models/Booking.js';
import Barber from '../models/Barber.js';
import Service from '../models/Service.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/ApiError.js';
import { isSlotAvailable } from '../utils/slots.js';
import { todayIn, addDays } from '../utils/time.js';

const populate = (q) => q.populate('barber', 'name avatar').populate('service', 'name').populate('user', 'name email phone');

/** Move a booking to another slot / barber / service (admin). */
export const reschedule = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw notFound('Booking not found');
  if (!ACTIVE_STATUSES.includes(booking.status)) throw badRequest('Only active bookings can be rescheduled');
  const settings = await Settings.get();
  const { barberId, date, slotTime, serviceId, notes } = req.body;

  if (serviceId) {
    const service = await Service.findById(serviceId);
    if (!service) throw notFound('Service not found');
    booking.service = service._id;
    booking.serviceName = service.name;
    booking.price = service.price;
    booking.duration = service.duration;
    if (booking.payment.status !== 'paid') booking.payment.amount = service.price;
  }
  if (notes !== undefined) booking.notes = notes;

  const newBarberId = barberId || String(booking.barber);
  const newDate = date || booking.date;
  const newSlot = slotTime || booking.slotTime;
  const changed = newBarberId !== String(booking.barber) || newDate !== booking.date || newSlot !== booking.slotTime || serviceId;
  if (changed) {
    const barber = await Barber.findById(newBarberId);
    if (!barber) throw notFound('Barber not found');
    const check = await isSlotAvailable({
      barber, date: newDate, slotTime: newSlot, duration: booking.duration, settings,
      ignoreBookingId: booking._id, allowPast: true,
    });
    if (!check.ok) throw badRequest(`Slot not available (${check.reason})`);
    booking.barber = barber._id;
    booking.date = newDate;
    booking.slotTime = newSlot;
  }
  await booking.save();
  res.json({ success: true, booking: await populate(Booking.findById(booking._id)).lean() });
});

/** Dashboard numbers for a given day (default today). */
export const stats = asyncHandler(async (req, res) => {
  const settings = await Settings.get();
  const date = req.query.date || todayIn(settings.timezone);
  const weekStart = addDays(date, -6);

  const [dayRows, weekRows, clients, barbers] = await Promise.all([
    Booking.find({ date }).lean(),
    Booking.aggregate([
      { $match: { date: { $gte: weekStart, $lte: date }, status: 'done' } },
      { $group: { _id: '$date', revenue: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$payment.amount', 0] } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    User.countDocuments({ role: 'user' }),
    Barber.find({ active: true }).sort({ order: 1 }).lean(),
  ]);

  const by = (s) => dayRows.filter((r) => r.status === s).length;
  const paid = dayRows.filter((r) => r.payment?.status === 'paid');
  const pendingPay = dayRows.filter((r) => r.status === 'done' && r.payment?.status !== 'paid');

  res.json({
    success: true,
    date,
    today: todayIn(settings.timezone),
    totals: {
      bookings: dayRows.length,
      waiting: by('waiting'),
      serving: by('serving'),
      done: by('done'),
      cancelled: by('cancelled') + by('no_show'),
      revenue: paid.reduce((s, r) => s + (r.payment.amount || 0), 0),
      pendingAmount: pendingPay.reduce((s, r) => s + (r.price || 0), 0),
      pendingCount: pendingPay.length,
      verifyingCount: dayRows.filter((r) => r.payment?.status === 'verifying').length,
      clients,
    },
    perBarber: barbers.map((b) => {
      const rows = dayRows.filter((r) => String(r.barber) === String(b._id));
      return {
        id: b._id,
        name: b.name,
        avatar: b.avatar,
        waiting: rows.filter((r) => r.status === 'waiting').length,
        serving: rows.find((r) => r.status === 'serving') || null,
        done: rows.filter((r) => r.status === 'done').length,
        revenue: rows.filter((r) => r.payment?.status === 'paid').reduce((s, r) => s + (r.payment.amount || 0), 0),
      };
    }),
    week: weekRows.map((w) => ({ date: w._id, revenue: w.revenue, count: w.count })),
  });
});

/** Payments / orders list with totals for a date range. */
export const payments = asyncHandler(async (req, res) => {
  const settings = await Settings.get();
  const to = req.query.to || todayIn(settings.timezone);
  const from = req.query.from || to;
  const filter = { date: { $gte: from, $lte: to }, status: { $in: ['done', 'serving', 'waiting'] } };
  if (req.query.paymentStatus) filter['payment.status'] = req.query.paymentStatus;
  if (req.query.barberId) filter.barber = req.query.barberId;
  const rows = await populate(Booking.find(filter).sort({ date: -1, slotTime: -1 })).lean();
  const summary = rows.reduce(
    (acc, r) => {
      if (r.payment?.status === 'paid') {
        acc.paid += r.payment.amount || 0;
        acc.byMethod[r.payment.method || 'cash'] = (acc.byMethod[r.payment.method || 'cash'] || 0) + (r.payment.amount || 0);
      } else if (r.payment?.status === 'verifying') {
        acc.verifying += r.payment.amount || r.price;
        acc.verifyingCount += 1;
      } else if (r.status === 'done') acc.pending += r.price;
      else acc.upcoming += r.price;
      return acc;
    },
    { paid: 0, pending: 0, upcoming: 0, verifying: 0, verifyingCount: 0, byMethod: {} },
  );
  res.json({ success: true, from, to, bookings: rows, summary });
});
