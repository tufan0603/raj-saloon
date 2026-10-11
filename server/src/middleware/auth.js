import User from '../models/User.js';
import { verifyToken } from '../utils/token.js';
import { unauthorized, forbidden } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Requires a valid JWT. Attaches req.user. */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw unauthorized('Session expired, please login again');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('Account not found');
  if (user.isBlocked) throw forbidden('Your account has been blocked. Contact the salon.');
  req.user = user;
  next();
});

/** Optional auth: attaches req.user if a valid token is present. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (user && !user.isBlocked) req.user = user;
  } catch {
    /* ignore invalid token for optional auth */
  }
  next();
});

export const adminOnly = (req, _res, next) => {
  if (!req.user || req.user.role !== 'admin') return next(forbidden('Admin access only'));
  next();
};
