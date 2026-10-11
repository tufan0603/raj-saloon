import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = ['booking_created', 'booking_cancelled', 'payment_claimed', 'client_registered', 'info'];

/** Admin-facing event feed (new booking, cancellation, UPI payment to verify...). */
const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'info', index: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: '', maxlength: 300 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // { bookingId, tokenNumber, date, barberId, url }
    readBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

// keep the feed small: auto-delete after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

export default mongoose.model('Notification', notificationSchema);
