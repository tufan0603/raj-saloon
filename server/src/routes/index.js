import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { protect, adminOnly, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as auth from '../controllers/authController.js';
import * as pub from '../controllers/publicController.js';
import * as bookings from '../controllers/bookingController.js';
import * as ab from '../controllers/adminBookingController.js';
import * as rep from '../controllers/adminReportController.js';
import * as cat from '../controllers/adminCatalogController.js';
import * as av from '../controllers/adminAvailabilityController.js';
import * as st from '../controllers/adminSettingsController.js';
import * as cl from '../controllers/adminClientController.js';
import { upload, uploadMedia, deleteMedia } from '../controllers/uploadController.js';
import * as nt from '../controllers/notificationController.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

// ---------- Auth ----------
router.post('/auth/register', authLimiter, validate(auth.schemas.register), auth.register);
router.post('/auth/login', authLimiter, validate(auth.schemas.login), auth.login);
router.post('/auth/forgot-password', authLimiter, validate(auth.schemas.forgot), auth.forgotPassword);
router.post('/auth/reset-password/:token', authLimiter, validate(auth.schemas.reset), auth.resetPassword);
router.get('/auth/me', protect, auth.me);
router.patch('/auth/me', protect, validate(auth.schemas.updateMe), auth.updateMe);
router.post('/auth/change-password', protect, validate(auth.schemas.changePassword), auth.changePassword);

// ---------- Public ----------
router.get('/settings', pub.getSettings);
router.get('/services', pub.listServices);
router.get('/barbers', pub.listBarbers);
router.get('/dates', pub.getBookableDates);
router.get('/slots', validate(pub.schemas.slotsQuery, 'query'), pub.getSlots);
router.get('/queue', optionalAuth, validate(pub.schemas.queueQuery, 'query'), pub.getQueue);

// ---------- User bookings ----------
router.post('/bookings', protect, validate(bookings.schemas.create), bookings.createBooking);
router.get('/bookings/mine', protect, bookings.myBookings);
router.get('/bookings/:id', protect, bookings.getBooking);
router.patch('/bookings/:id/cancel', protect, validate(bookings.schemas.cancel), bookings.cancelBooking);
router.patch('/bookings/:id/payment-claim', protect, validate(bookings.schemas.claim), bookings.claimPayment);

// ---------- Web push (any logged-in user; only admins receive events for now) ----------
router.get('/push/public-key', nt.publicKey);
router.post('/push/subscribe', protect, validate(nt.schemas.subscribe), nt.subscribe);
router.delete('/push/subscribe', protect, validate(nt.schemas.unsubscribe), nt.unsubscribe);

// ---------- Admin ----------
const admin = Router();
admin.use(protect, adminOnly);

admin.get('/notifications', validate(nt.schemas.listQuery, 'query'), nt.list);
admin.post('/notifications/read', validate(nt.schemas.read), nt.markRead);
admin.post('/notifications/test', nt.sendTest);

admin.get('/stats', rep.stats);
admin.get('/payments', rep.payments);
admin.get('/queue', validate(ab.schemas.queueQuery, 'query'), ab.adminQueue);
admin.get('/bookings', validate(ab.schemas.listQuery, 'query'), ab.listBookings);
admin.post('/bookings', validate(ab.schemas.create), ab.createForClient);
admin.patch('/bookings/:id/status', validate(ab.schemas.status), ab.updateStatus);
admin.patch('/bookings/:id/payment', validate(ab.schemas.payment), ab.updatePayment);
admin.patch('/bookings/:id', validate(ab.schemas.reschedule), rep.reschedule);
admin.delete('/bookings/:id', ab.deleteBooking);
admin.post('/barbers/:barberId/call-next', ab.callNext);
admin.get('/barbers/:id/usage', cat.barberUsage);

admin.get('/services', cat.listServices);
admin.post('/services', validate(cat.schemas.service), cat.createService);
admin.patch('/services/:id', validate(cat.schemas.servicePatch), cat.updateService);
admin.delete('/services/:id', cat.deleteService);

admin.get('/barbers', cat.listBarbers);
admin.post('/barbers', validate(cat.schemas.barber), cat.createBarber);
admin.patch('/barbers/:id', validate(cat.schemas.barber.partial()), cat.updateBarber);
admin.delete('/barbers/:id', cat.deleteBarber);

admin.get('/availability/month', validate(av.schemas.monthQuery, 'query'), av.monthOverview);
admin.get('/availability/day', validate(av.schemas.dayQuery, 'query'), av.dayDetail);
admin.put('/availability/day', validate(av.schemas.upsert), av.upsertDay);
admin.post('/availability/bulk', validate(av.schemas.bulkOff), av.bulkOff);
admin.delete('/availability/day', validate(av.schemas.dayQuery, 'query'), av.clearDay);

admin.get('/settings', st.getSettings);
admin.patch('/settings', validate(st.schemas.patch), st.updateSettings);
admin.post('/settings/gallery', validate(st.schemas.galleryAdd), st.addGallery);
admin.patch('/settings/gallery/:itemId', validate(st.schemas.galleryPatch), st.updateGallery);
admin.delete('/settings/gallery/:itemId', st.removeGallery);

admin.get('/clients', validate(cl.schemas.listQuery, 'query'), cl.listClients);
admin.post('/clients/quick', validate(cl.schemas.quickCreate), cl.findOrCreateByPhone);
admin.get('/clients/:id', cl.getClient);
admin.patch('/clients/:id', validate(cl.schemas.patch), cl.updateClient);

admin.post('/upload', upload.array('files', 10), uploadMedia);
admin.delete('/upload', validate(z.object({ publicId: z.string(), resourceType: z.enum(['image', 'video']).optional() })), deleteMedia);

router.use('/admin', admin);

export default router;
