/**
 * Seed default data: salon settings, services, barbers, an admin user and
 * placeholder photos for the home page (replace them from Admin -> Content).
 * Usage: npm run seed   (safe to re-run; it only fills in what is missing)
 */
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import mongoose from 'mongoose';
import Settings from './models/Settings.js';
import Service from './models/Service.js';
import Barber from './models/Barber.js';
import User from './models/User.js';

const ADMIN = {
  name: process.env.SEED_ADMIN_NAME || 'Salon Owner',
  email: (process.env.SEED_ADMIN_EMAIL || env.adminEmails[0] || 'owner@gmail.com').toLowerCase(),
  phone: process.env.SEED_ADMIN_PHONE || '9999999999',
  password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
};

const SERVICES = [
  { name: 'Hair Cut', description: 'Classic cut with wash & styling', price: 150, duration: 30, order: 1 },
  { name: 'Beard Trim & Shape', description: 'Clean trim, line-up and shape', price: 80, duration: 15, order: 2 },
  { name: 'Hair + Beard Combo', description: 'Hair cut and beard trim together. Fast & save.', price: 200, compareAtPrice: 230, duration: 35, popular: true, order: 3 },
  { name: 'Head Massage', description: '15 min relaxing oil massage', price: 100, duration: 15, order: 4 },
];

// Placeholder photos (Unsplash). Replace with your own from Admin -> Content & gallery.
const U = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const ph = (id, category, caption = '', w) => ({ url: U(id, w), publicId: `placeholder/${id}`, resourceType: 'image', category, caption });

const BARBERS = [
  { name: 'Ramesh', title: 'Senior Barber', bio: '12 years of fades and classic cuts.', order: 1, avatar: { url: U('1534297635766-a262cdcb8ee4', 800), publicId: 'placeholder/ramesh' } },
  { name: 'Rahul', title: 'Stylist', bio: 'Modern styles, beard artistry.', order: 2, avatar: { url: U('1521590832167-7bcbfaa6381f', 800), publicId: 'placeholder/rahul' } },
];

const HERO = { url: U('1585747860715-2ba37e788b70', 1600), publicId: 'placeholder/hero', resourceType: 'image', category: 'shop' };

const GALLERY = [
  ph('1622286342621-4bd786c2447c', 'shop', 'The chairs'),
  ph('1567894340315-735d7c361db0', 'shop', 'Front desk'),
  ph('1517832606299-7ae9b720a186', 'shop', 'Classic chair'),
  ph('1618077360395-f3068be8e001', 'shop', 'Evening vibe'),
  ph('1503951914875-452162b0f3f1', 'demo', 'Precision fade'),
  ph('1599351431202-1e0f0137899a', 'demo', 'Beard line-up'),
  ph('1512690459411-b9245aed614b', 'demo', 'Scissor work'),
  ph('1583195764036-6dc248ac07d9', 'style', 'Skin fade'),
  ph('1593702275687-f8b402bf1fb5', 'style', 'Textured crop'),
  ph('1605497788044-5a32c7078486', 'style', 'Classic taper'),
  ph('1621605815971-fbc98d665033', 'style', 'Full beard shape'),
  ph('1532710093739-9470acff878f', 'style', 'Pompadour'),
  ph('1493256338651-d82f7acb2b38', 'style', 'Side part'),
  ph('1559599101-f09722fb4948', 'style', 'Buzz & beard'),
  ph('1596462502278-27bfdc403348', 'style', 'Curly top'),
  ph('1587909209111-5097ee578ec3', 'style', 'Mid fade'),
];

async function run() {
  await connectDB();

  const settings = await Settings.get();
  let changed = false;
  if (!settings.phone) {
    settings.set({ salonName: 'SaloonEase', tagline: 'Fast salon queue & slot booking', phone: ADMIN.phone, whatsapp: ADMIN.phone });
    changed = true;
  }
  if (!settings.address) {
    settings.set({ address: 'Shop 12, Main Road, Near Bus Stand', about: 'A neighbourhood barbershop with clean fades, sharp beards and no waiting around. Book a slot, get a token and walk in when it is your turn.' });
    changed = true;
  }
  if (!settings.heroImage?.url) {
    settings.heroImage = HERO;
    changed = true;
  }
  if (!settings.gallery?.length) {
    settings.gallery = GALLERY;
    changed = true;
  }
  if (changed) await settings.save();
  console.log('[seed] settings ok');

  for (const s of SERVICES) {
    if (!(await Service.findOne({ name: s.name }))) await Service.create(s);
  }
  console.log('[seed] services ok');

  for (const b of BARBERS) {
    const exists = await Barber.findOne({ name: b.name });
    if (!exists) await Barber.create(b);
    else if (!exists.avatar?.url) {
      exists.avatar = b.avatar;
      await exists.save();
    }
  }
  console.log('[seed] barbers ok');

  let admin = await User.findOne({ email: ADMIN.email });
  if (!admin) {
    admin = await User.create({ ...ADMIN, role: 'admin' });
    console.log(`[seed] admin created -> ${ADMIN.email} / ${ADMIN.password}`);
  } else if (admin.role !== 'admin') {
    admin.role = 'admin';
    await admin.save();
    console.log(`[seed] promoted ${ADMIN.email} to admin`);
  } else {
    console.log(`[seed] admin exists -> ${ADMIN.email}`);
  }

  await mongoose.disconnect();
  console.log('[seed] done');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
