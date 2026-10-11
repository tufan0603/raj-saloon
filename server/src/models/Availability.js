import mongoose from 'mongoose';

/** Per-barber, per-date override of working hours (day off, custom hours, blocked slots). */
const availabilitySchema = new mongoose.Schema(
  {
    barber: { type: mongoose.Schema.Types.ObjectId, ref: 'Barber', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    isOff: { type: Boolean, default: false },
    start: { type: String, default: '' }, // HH:mm, empty => default
    end: { type: String, default: '' },
    blockedSlots: { type: [String], default: [] }, // ["13:00", "13:15"]
    note: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true },
);

availabilitySchema.index({ barber: 1, date: 1 }, { unique: true });

export default mongoose.model('Availability', availabilitySchema);
