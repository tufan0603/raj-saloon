import webpush from 'web-push';
import Notification from '../models/Notification.js';
import PushSubscription from '../models/PushSubscription.js';
import User from '../models/User.js';
import { env } from '../config/env.js';

export const isPushConfigured = () => Boolean(env.vapid.publicKey && env.vapid.privateKey);

if (isPushConfigured()) {
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
}

/**
 * Record an admin notification and push it to every admin device.
 * Fire-and-forget: callers should not await on the request path.
 */
export async function notifyAdmins({ type = 'info', title, body = '', data = {} }) {
  const note = await Notification.create({ type, title, body, data });
  if (!isPushConfigured()) return note;

  const admins = await User.find({ role: 'admin', isBlocked: false }).select('_id').lean();
  const subs = await PushSubscription.find({ user: { $in: admins.map((a) => a._id) } }).lean();
  if (!subs.length) return note;

  const payload = JSON.stringify({
    id: String(note._id),
    type,
    title,
    body,
    url: data.url || '/admin',
    tag: data.tag || `saloonease-${type}`,
  });

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 60, urgency: 'high' });
        await PushSubscription.updateOne({ _id: s._id }, { $set: { lastUsedAt: new Date() } });
      } catch (err) {
        // 404 / 410 = subscription expired or unsubscribed -> drop it
        if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id });
        else console.warn('[push] failed:', err.statusCode || err.message);
      }
    }),
  );
  return note;
}

/** Non-blocking wrapper used from request handlers. */
export const notifyAdminsAsync = (args) => {
  notifyAdmins(args).catch((e) => console.warn('[notify] failed:', e.message));
};
