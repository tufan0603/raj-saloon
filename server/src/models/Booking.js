import mongoose from 'mongoose';

export const BOOKING_STATUSES = ['waiting', 'serving', 'done', 'cancelled', 'no_show'];
export const ACTIVE_STATUSES = ['waiting', 'serving'];
// verifying = client says they paid via UPI (reference submitted), waiting for the barber to confirm
export const PAYMENT_STATUSES = ['pending', 'verifying', 'paid', 'refunded'];
export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'online'];

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    customerName: { type: String, required: true, trim: true, maxlength: 80 },
    customerPhone: { type: String, trim: true, maxlength: 15, default: '' },
    barber: { type: mongoose.Schema.Types.ObjectId, ref: 'Barber', required: true, index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    // Snapshot so price/duration history never changes after booking
    serviceName: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    duration: { type: Number, required: true, min: 5 },

    date: { type: String, required: true, index: true }, // YYYY-MM-DD (salon local date)
    slotTime: { type: String, required: true }, // HH:mm
    tokenNumber: { type: Number, required: true },

    status: { type: String, enum: BOOKING_STATUSES, default: 'waiting', index: true },
    source: { type: String, enum: ['online', 'admin', 'walk_in'], default: 'online' },
    notes: { type: String, trim: true, maxlength: 300, default: '' },

    payment: {
      status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
      method: { type: String, enum: [...PAYMENT_METHODS, null], default: null },
      amount: { type: Number, min: 0, default: 0 },
      paidAt: Date,
      claimedAt: Date,
      reference: { type: String, trim: true, default: '' },
    },

    servedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: { type: String, enum: ['user', 'admin', null], default: null },
    cancelReason: { type: String, trim: true, maxlength: 200, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

bookingSchema.index({ date: 1, tokenNumber: 1 }, { unique: true });
bookingSchema.index({ date: 1, barber: 1, status: 1 });
bookingSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Booking', bookingSchema);
