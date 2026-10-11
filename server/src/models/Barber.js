import mongoose from 'mongoose';

const barberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    title: { type: String, trim: true, default: 'Barber' },
    bio: { type: String, trim: true, maxlength: 300, default: '' },
    avatar: { url: String, publicId: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    active: { type: Boolean, default: true },
    // Optional override of salon-wide hours ("HH:mm"); empty => use settings
    workingHours: {
      start: { type: String, default: '' },
      end: { type: String, default: '' },
    },
    weeklyOff: { type: [Number], default: [] }, // 0=Sun ... 6=Sat (in addition to salon weeklyOff)
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('Barber', barberSchema);
