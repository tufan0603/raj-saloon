import crypto from 'crypto';
import { z } from 'zod';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import { env } from '../config/env.js';
import { signToken } from '../utils/token.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, unauthorized } from '../utils/ApiError.js';
import { sendMail, resetPasswordTemplate } from '../utils/mailer.js';
import { notifyAdminsAsync } from '../utils/notify.js';

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email');
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid mobile number')
  .or(z.literal(''))
  .optional();
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters').max(72);

export const schemas = {
  register: z.object({
    name: z.string().trim().min(2, 'Name is too short').max(80),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
  }),
  login: z.object({ email: emailSchema, password: z.string().min(1, 'Password is required') }),
  forgot: z.object({ email: emailSchema }),
  reset: z.object({ password: passwordSchema }),
  updateMe: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: phoneSchema,
    avatar: z.object({ url: z.string().url(), publicId: z.string() }).nullable().optional(),
  }),
  changePassword: z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }),
};

const isAdminEmail = (email) => env.adminEmails.includes(email.toLowerCase());

const respondWithUser = (res, user, status = 200) =>
  res.status(status).json({ success: true, token: signToken(user), user: user.toSafeJSON() });

export const register = asyncHandler(async (req, res) => {
  const { name, email, phone = '', password } = req.body;
  const exists = await User.findOne({ email });
  if (exists) throw badRequest('An account with this email already exists');
  const user = await User.create({
    name,
    email,
    phone,
    password,
    role: isAdminEmail(email) ? 'admin' : 'user',
    lastLoginAt: new Date(),
  });
  if (user.role === 'user') {
    notifyAdminsAsync({
      type: 'client_registered',
      title: `New client: ${user.name}`,
      body: `${user.phone || 'no phone'} - ${user.email}`,
      data: { userId: user._id, url: `/admin/clients/${user._id}`, tag: `client-${user._id}` },
    });
  }
  respondWithUser(res, user, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw unauthorized('Invalid email or password');
  if (user.isBlocked) throw unauthorized('Your account has been blocked. Contact the salon.');
  // Promote to admin if email was added to ADMIN_EMAILS after registration
  if (user.role !== 'admin' && isAdminEmail(email)) user.role = 'admin';
  user.lastLoginAt = new Date();
  await user.save();
  respondWithUser(res, user);
});

export const me = asyncHandler(async (req, res) => {
  await req.user.populate('barber', 'name avatar');
  res.json({ success: true, user: req.user.toSafeJSON() });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  if (avatar !== undefined) req.user.avatar = avatar || undefined;
  await req.user.save();
  res.json({ success: true, user: req.user.toSafeJSON() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) throw badRequest('Current password is incorrect');
  user.password = req.body.newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  // Always respond the same way to avoid leaking which emails exist
  const generic = { success: true, message: 'If that email exists, a reset link has been sent.' };
  if (!user) return res.json(generic);

  const raw = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const settings = await Settings.get();
  const link = `${env.clientUrl}/reset-password/${raw}`;
  try {
    await sendMail({ to: user.email, ...resetPasswordTemplate({ name: user.name, link, salonName: settings.salonName }) });
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    console.error('[mail] failed', err.message);
    throw badRequest('Could not send email right now. Please try again later.');
  }
  res.json({ ...generic, ...(env.nodeEnv === 'development' ? { devLink: link } : {}) });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+password +resetPasswordToken +resetPasswordExpires');
  if (!user) throw badRequest('Reset link is invalid or has expired');
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  respondWithUser(res, user);
});
