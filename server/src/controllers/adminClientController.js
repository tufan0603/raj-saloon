import { z } from 'zod';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound, badRequest } from '../utils/ApiError.js';

export const schemas = {
  listQuery: z.object({
    search: z.string().trim().max(60).optional(),
    role: z.enum(['user', 'admin']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
  patch: z
    .object({
      name: z.string().trim().min(2).max(80),
      phone: z.string().trim().max(15),
      role: z.enum(['user', 'admin']),
      isBlocked: z.boolean(),
    })
    .partial(),
  quickCreate: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(7).max(15),
    email: z.string().trim().toLowerCase().email().optional(),
  }),
};

export const listClients = asyncHandler(async (req, res) => {
  const { search, role, page, limit } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const ids = users.map((u) => u._id);
  const agg = await Booking.aggregate([
    { $match: { user: { $in: ids } } },
    {
      $group: {
        _id: '$user',
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
        spent: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$payment.amount', 0] } },
        lastVisit: { $max: '$date' },
      },
    },
  ]);
  const statMap = Object.fromEntries(agg.map((a) => [String(a._id), a]));
  const clients = users.map((u) => {
    const { password, resetPasswordToken, resetPasswordExpires, ...safe } = u;
    const s = statMap[String(u._id)] || {};
    return { ...safe, id: u._id, stats: { total: s.total || 0, done: s.done || 0, noShow: s.noShow || 0, spent: s.spent || 0, lastVisit: s.lastVisit || null } };
  });
  res.json({ success: true, clients, total, page, limit });
});

export const getClient = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) throw notFound('Client not found');
  const bookings = await Booking.find({ user: user._id })
    .populate('barber', 'name')
    .sort({ date: -1, slotTime: -1 })
    .limit(50)
    .lean();
  const { password, resetPasswordToken, resetPasswordExpires, ...safe } = user;
  res.json({ success: true, client: { ...safe, id: user._id }, bookings });
});

export const updateClient = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('Client not found');
  if (String(user._id) === String(req.user._id) && (req.body.role === 'user' || req.body.isBlocked)) {
    throw badRequest('You cannot demote or block your own account');
  }
  Object.assign(user, req.body);
  await user.save();
  res.json({ success: true, client: user.toSafeJSON() });
});

/** Walk-in clients without an account: find by phone or create a lightweight record. */
export const findOrCreateByPhone = asyncHandler(async (req, res) => {
  const { name, phone, email } = req.body;
  let user = await User.findOne({ $or: [{ phone }, ...(email ? [{ email }] : [])] });
  if (!user) {
    const pseudoEmail = email || `walkin.${phone.replace(/\D/g, '')}@guest.local`;
    const randomPass = Math.random().toString(36).slice(2) + Date.now().toString(36);
    user = await User.create({ name, phone, email: pseudoEmail, password: randomPass, role: 'user' });
  }
  res.json({ success: true, client: user.toSafeJSON() });
});
