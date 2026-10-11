import { z } from 'zod';
import Service from '../models/Service.js';
import Barber from '../models/Barber.js';
import Booking, { ACTIVE_STATUSES } from '../models/Booking.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/ApiError.js';
import { destroyAsset, isCloudinaryConfigured } from '../config/cloudinary.js';
import { TIME_RE } from '../utils/time.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const media = z.object({ url: z.string().url(), publicId: z.string() }).nullable().optional();

export const schemas = {
  service: z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(300).optional(),
    price: z.coerce.number().min(0),
    compareAtPrice: z.coerce.number().min(0).nullable().optional(),
    duration: z.coerce.number().int().min(5).max(480),
    image: media,
    popular: z.boolean().optional(),
    active: z.boolean().optional(),
    order: z.coerce.number().int().optional(),
  }),
  servicePatch: z
    .object({
      name: z.string().trim().min(2).max(80),
      description: z.string().trim().max(300),
      price: z.coerce.number().min(0),
      compareAtPrice: z.coerce.number().min(0).nullable(),
      duration: z.coerce.number().int().min(5).max(480),
      image: media,
      popular: z.boolean(),
      active: z.boolean(),
      order: z.coerce.number().int(),
    })
    .partial(),
  barber: z.object({
    name: z.string().trim().min(2).max(60),
    title: z.string().trim().max(60).optional(),
    bio: z.string().trim().max(300).optional(),
    avatar: media,
    userId: objectId.nullable().optional(),
    active: z.boolean().optional(),
    workingHours: z.object({ start: z.string().regex(TIME_RE).or(z.literal('')), end: z.string().regex(TIME_RE).or(z.literal('')) }).optional(),
    weeklyOff: z.array(z.number().int().min(0).max(6)).optional(),
    order: z.coerce.number().int().optional(),
  }),
};

const removeMedia = async (m) => {
  if (m?.publicId && isCloudinaryConfigured()) await destroyAsset(m.publicId).catch(() => {});
};

// ---------- Services ----------
export const listServices = asyncHandler(async (_req, res) => {
  res.json({ success: true, services: await Service.find().sort({ order: 1, createdAt: 1 }).lean() });
});
export const createService = asyncHandler(async (req, res) => {
  const service = await Service.create(req.body);
  res.status(201).json({ success: true, service });
});
export const updateService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw notFound('Service not found');
  if (req.body.image !== undefined && service.image?.publicId && service.image.publicId !== req.body.image?.publicId) {
    await removeMedia(service.image);
  }
  Object.assign(service, req.body);
  if (req.body.image === null) service.image = undefined;
  await service.save();
  res.json({ success: true, service });
});
export const deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw notFound('Service not found');
  const inUse = await Booking.exists({ service: service._id, status: { $in: ACTIVE_STATUSES } });
  if (inUse) throw badRequest('This service has active bookings. Mark it inactive instead.');
  await removeMedia(service.image);
  await service.deleteOne();
  res.json({ success: true });
});

// ---------- Barbers ----------
export const listBarbers = asyncHandler(async (_req, res) => {
  res.json({ success: true, barbers: await Barber.find().populate('user', 'name email').sort({ order: 1, createdAt: 1 }).lean() });
});
const syncUserLink = async (barber, userId) => {
  if (userId === undefined) return;
  await User.updateMany({ barber: barber._id }, { $set: { barber: null } });
  barber.user = userId || null;
  if (userId) await User.findByIdAndUpdate(userId, { $set: { barber: barber._id, role: 'admin' } });
};
export const createBarber = asyncHandler(async (req, res) => {
  const { userId, ...data } = req.body;
  const barber = new Barber(data);
  await syncUserLink(barber, userId);
  await barber.save();
  res.status(201).json({ success: true, barber });
});
export const updateBarber = asyncHandler(async (req, res) => {
  const barber = await Barber.findById(req.params.id);
  if (!barber) throw notFound('Barber not found');
  const { userId, ...data } = req.body;
  if (data.avatar !== undefined && barber.avatar?.publicId && barber.avatar.publicId !== data.avatar?.publicId) {
    await removeMedia(barber.avatar);
  }
  Object.assign(barber, data);
  if (data.avatar === null) barber.avatar = undefined;
  await syncUserLink(barber, userId);
  await barber.save();
  res.json({ success: true, barber });
});
/**
 * DELETE /admin/barbers/:id            -> refuses (400) when the barber still has waiting/serving bookings
 * DELETE /admin/barbers/:id?force=true -> cancels those bookings (cancelledBy admin) and deletes the barber
 * Past bookings keep a reference to the barber id for history.
 */
export const deleteBarber = asyncHandler(async (req, res) => {
  const barber = await Barber.findById(req.params.id);
  if (!barber) throw notFound('Barber not found');
  const activeFilter = { barber: barber._id, status: { $in: ACTIVE_STATUSES } };
  const active = await Booking.countDocuments(activeFilter);
  const force = String(req.query.force) === 'true';
  if (active && !force) {
    throw badRequest(`${barber.name} has ${active} active booking(s). Cancel or move them first, delete with force to cancel them, or mark the barber inactive.`);
  }
  let cancelled = 0;
  if (active && force) {
    const r = await Booking.updateMany(activeFilter, {
      $set: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'admin', cancelReason: 'Barber removed' },
    });
    cancelled = r.modifiedCount;
  }
  await removeMedia(barber.avatar);
  await User.updateMany({ barber: barber._id }, { $set: { barber: null } });
  await barber.deleteOne();
  res.json({ success: true, cancelledBookings: cancelled });
});

/** Admin: count of bookings tied to a barber (used by the delete confirmation). */
export const barberUsage = asyncHandler(async (req, res) => {
  const [active, total] = await Promise.all([
    Booking.countDocuments({ barber: req.params.id, status: { $in: ACTIVE_STATUSES } }),
    Booking.countDocuments({ barber: req.params.id }),
  ]);
  res.json({ success: true, active, total });
});
