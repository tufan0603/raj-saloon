import { z } from 'zod';
import Notification from '../models/Notification.js';
import PushSubscription from '../models/PushSubscription.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { isPushConfigured, notifyAdmins } from '../utils/notify.js';
import { badRequest } from '../utils/ApiError.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const schemas = {
  listQuery: z.object({
    since: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  }),
  read: z.object({ ids: z.array(objectId).optional(), all: z.boolean().optional() }),
  subscribe: z.object({
    subscription: z.object({
      endpoint: z.string().url(),
      keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(5) }),
    }),
    userAgent: z.string().max(300).optional(),
  }),
  unsubscribe: z.object({ endpoint: z.string().url() }),
};

/** Admin feed: latest notifications + unread count for this admin. */
export const list = asyncHandler(async (req, res) => {
  const { since, limit } = req.query;
  const filter = since ? { createdAt: { $gt: new Date(since) } } : {};
  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ readBy: { $ne: req.user._id } }),
  ]);
  res.json({
    success: true,
    serverTime: new Date().toISOString(),
    unreadCount,
    pushConfigured: isPushConfigured(),
    notifications: notifications.map((n) => ({ ...n, read: n.readBy.some((id) => String(id) === String(req.user._id)), readBy: undefined })),
  });
});

export const markRead = asyncHandler(async (req, res) => {
  const { ids, all } = req.body;
  if (!ids?.length && !all) throw badRequest('ids or all required');
  const filter = all ? { readBy: { $ne: req.user._id } } : { _id: { $in: ids } };
  const r = await Notification.updateMany(filter, { $addToSet: { readBy: req.user._id } });
  res.json({ success: true, updated: r.modifiedCount });
});

export const publicKey = (_req, res) => {
  res.json({ success: true, configured: isPushConfigured(), publicKey: env.vapid.publicKey });
};

export const subscribe = asyncHandler(async (req, res) => {
  if (!isPushConfigured()) throw badRequest('Push notifications are not configured on the server (VAPID keys)');
  const { subscription, userAgent = '' } = req.body;
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { $set: { user: req.user._id, keys: subscription.keys, userAgent, lastUsedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const count = await PushSubscription.countDocuments({ user: req.user._id });
  res.status(201).json({ success: true, devices: count });
});

export const unsubscribe = asyncHandler(async (req, res) => {
  await PushSubscription.deleteOne({ endpoint: req.body.endpoint, user: req.user._id });
  res.json({ success: true });
});

/** Admin taps "Send test notification" to verify sound + push on this phone. */
export const sendTest = asyncHandler(async (req, res) => {
  const note = await notifyAdmins({
    type: 'info',
    title: 'Test notification',
    body: `Sent by ${req.user.name}. If you can read this, notifications work.`,
    data: { url: '/admin', tag: 'saloonease-test' },
  });
  res.json({ success: true, id: note._id, pushConfigured: isPushConfigured() });
});
