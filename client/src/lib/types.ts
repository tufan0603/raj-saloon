export type Role = 'user' | 'admin';

export interface Media {
  _id?: string;
  url: string;
  publicId: string;
  resourceType?: 'image' | 'video';
  caption?: string;
  category?: MediaCategory;
}

export type MediaCategory = 'shop' | 'barber' | 'demo' | 'style' | 'other';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  barber?: string | { _id: string; name: string; avatar?: Media } | null;
  avatar?: Media | null;
  isBlocked?: boolean;
  createdAt?: string;
}

export interface Service {
  _id: string;
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number | null;
  duration: number;
  image?: Media | null;
  popular?: boolean;
  active: boolean;
  order: number;
}

export interface Barber {
  _id: string;
  name: string;
  title?: string;
  bio?: string;
  avatar?: Media | null;
  user?: { _id: string; name: string; email: string } | string | null;
  active: boolean;
  workingHours?: { start: string; end: string };
  weeklyOff?: number[];
  order: number;
}

export interface Settings {
  salonName: string;
  tagline: string;
  about: string;
  phone: string;
  whatsapp: string;
  address: string;
  mapUrl: string;
  upiId?: string;
  announcement: string;
  announcementActive: boolean;
  heroImage?: Media | null;
  logo?: Media | null;
  gallery: Media[];
  openTime: string;
  closeTime: string;
  slotInterval: number;
  weeklyOff: number[];
  maxAdvanceDays: number;
  tokenStart: number;
  allowOnlineBooking: boolean;
  maxActiveBookingsPerUser: number;
  timezone: string;
  currency: string;
  today?: string;
}

export type BookingStatus = 'waiting' | 'serving' | 'done' | 'cancelled' | 'no_show';
export type PaymentStatus = 'pending' | 'verifying' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'online';

export interface Payment {
  status: PaymentStatus;
  method?: PaymentMethod | null;
  amount: number;
  paidAt?: string;
  claimedAt?: string;
  reference?: string;
}

export interface Booking {
  _id: string;
  user?: { _id: string; name: string; email: string; phone: string } | string | null;
  customerName: string;
  customerPhone: string;
  barber: { _id: string; name: string; avatar?: Media } | string;
  service: { _id: string; name: string } | string;
  serviceName: string;
  price: number;
  duration: number;
  date: string;
  slotTime: string;
  tokenNumber: number;
  status: BookingStatus;
  source: 'online' | 'admin' | 'walk_in';
  notes?: string;
  payment: Payment;
  servedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
}

export interface QueueEntry {
  id: string;
  tokenNumber: number;
  customerName: string;
  customerPhone?: string;
  userId: string | null;
  serviceName: string;
  price: number;
  duration: number;
  slotTime: string;
  status: BookingStatus;
  payment: Partial<Payment>;
  source: string;
  notes?: string;
  servedAt?: string;
  position?: number;
  clientsAhead?: number;
  estimatedStart?: string;
  waitMinutes?: number;
  remainingMinutes?: number;
}

export interface QueueData {
  date: string;
  barberId: string;
  now: string;
  serving: QueueEntry | null;
  waiting: QueueEntry[];
  finished: QueueEntry[];
  totalWaitMinutes: number;
}

export interface Slot {
  time: string;
  available: boolean;
  reason: '' | 'past' | 'booked' | 'blocked';
}

export interface SlotsResponse {
  open: boolean;
  reason?: string;
  slots: Slot[];
  window?: { start: string; end: string; blocked: string[]; note?: string };
}
