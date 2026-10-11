import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    url: String,
    publicId: String,
    resourceType: { type: String, enum: ['image', 'video'], default: 'image' },
    caption: { type: String, default: '' },
    // Where the media is used on the home page
    category: { type: String, enum: ['shop', 'barber', 'demo', 'style', 'other'], default: 'style' },
  },
  { _id: true },
);

/** Single-document salon settings & CMS content, managed from the admin panel. */
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    salonName: { type: String, default: 'SaloonEase' },
    tagline: { type: String, default: 'Fast salon queue & slot booking' },
    about: {
      type: String,
      default: 'Walk in with a token, skip the waiting. Book your slot and track your live turn.',
    },
    phone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    address: { type: String, default: '' },
    mapUrl: { type: String, default: '' },
    upiId: { type: String, default: '' },
    announcement: { type: String, default: '' },
    announcementActive: { type: Boolean, default: false },
    heroImage: mediaSchema,
    logo: mediaSchema,
    gallery: { type: [mediaSchema], default: [] },

    openTime: { type: String, default: '10:00' },
    closeTime: { type: String, default: '20:00' },
    slotInterval: { type: Number, default: 15, min: 5, max: 120 },
    weeklyOff: { type: [Number], default: [] },
    maxAdvanceDays: { type: Number, default: 7, min: 0, max: 60 },
    tokenStart: { type: Number, default: 101 },
    allowOnlineBooking: { type: Boolean, default: true },
    maxActiveBookingsPerUser: { type: Number, default: 2 },
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
  },
  { timestamps: true },
);

settingsSchema.statics.get = async function () {
  let doc = await this.findOne({ key: 'main' });
  if (!doc) doc = await this.create({ key: 'main' });
  return doc;
};

export default mongoose.model('Settings', settingsSchema);
