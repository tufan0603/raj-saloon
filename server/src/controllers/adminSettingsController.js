import { z } from 'zod';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/ApiError.js';
import { destroyAsset, isCloudinaryConfigured } from '../config/cloudinary.js';
import { TIME_RE, toMinutes } from '../utils/time.js';

const media = z
  .object({
    url: z.string().url(),
    publicId: z.string(),
    resourceType: z.enum(['image', 'video']).optional(),
    caption: z.string().max(120).optional(),
    category: z.enum(['shop', 'barber', 'demo', 'style', 'other']).optional(),
  })
  .nullable();

export const schemas = {
  patch: z
    .object({
      salonName: z.string().trim().min(2).max(60),
      tagline: z.string().trim().max(120),
      about: z.string().trim().max(1000),
      phone: z.string().trim().max(20),
      whatsapp: z.string().trim().max(20),
      address: z.string().trim().max(300),
      mapUrl: z.string().trim().max(500),
      upiId: z.string().trim().max(80),
      announcement: z.string().trim().max(300),
      announcementActive: z.boolean(),
      heroImage: media,
      logo: media,
      openTime: z.string().regex(TIME_RE),
      closeTime: z.string().regex(TIME_RE),
      slotInterval: z.coerce.number().int().min(5).max(120),
      weeklyOff: z.array(z.number().int().min(0).max(6)),
      maxAdvanceDays: z.coerce.number().int().min(0).max(60),
      tokenStart: z.coerce.number().int().min(1),
      allowOnlineBooking: z.boolean(),
      maxActiveBookingsPerUser: z.coerce.number().int().min(1).max(10),
      timezone: z.string().min(3).max(60),
    })
    .partial(),
  galleryAdd: z.object({ items: z.array(media.unwrap()).min(1).max(20) }),
  galleryPatch: z.object({ caption: z.string().max(120).optional(), category: z.enum(['shop', 'barber', 'demo', 'style', 'other']).optional() }),
};

const removeMedia = async (m) => {
  if (m?.publicId && isCloudinaryConfigured()) await destroyAsset(m.publicId, m.resourceType || 'image').catch(() => {});
};

export const getSettings = asyncHandler(async (_req, res) => {
  res.json({ success: true, settings: await Settings.get() });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const s = await Settings.get();
  const data = req.body;
  const open = data.openTime || s.openTime;
  const close = data.closeTime || s.closeTime;
  if (toMinutes(open) >= toMinutes(close)) throw badRequest('Opening time must be before closing time');
  if (data.timezone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: data.timezone });
    } catch {
      throw badRequest('Invalid timezone');
    }
  }
  for (const key of ['heroImage', 'logo']) {
    if (data[key] !== undefined && s[key]?.publicId && s[key].publicId !== data[key]?.publicId) await removeMedia(s[key]);
    if (data[key] === null) {
      s[key] = undefined;
      delete data[key];
    }
  }
  Object.assign(s, data);
  await s.save();
  res.json({ success: true, settings: s });
});

export const addGallery = asyncHandler(async (req, res) => {
  const s = await Settings.get();
  s.gallery.push(...req.body.items);
  await s.save();
  res.json({ success: true, gallery: s.gallery });
});

export const updateGallery = asyncHandler(async (req, res) => {
  const s = await Settings.get();
  const item = s.gallery.id(req.params.itemId);
  if (!item) throw notFound('Gallery item not found');
  if (req.body.caption !== undefined) item.caption = req.body.caption;
  if (req.body.category !== undefined) item.category = req.body.category;
  await s.save();
  res.json({ success: true, gallery: s.gallery });
});

export const removeGallery = asyncHandler(async (req, res) => {
  const s = await Settings.get();
  const item = s.gallery.id(req.params.itemId);
  if (!item) throw notFound('Gallery item not found');
  await removeMedia(item);
  item.deleteOne();
  await s.save();
  res.json({ success: true, gallery: s.gallery });
});
