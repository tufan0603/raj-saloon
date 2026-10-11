/**
 * End-to-end API test. Runs against a live server (default http://localhost:5000/api)
 * and the database in server/.env. Creates E2E-prefixed data and removes it at the end.
 *
 *   npm run test:e2e            (server must be running: npm run dev)
 *   API_URL=https://my-api/api ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run test:e2e
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'admin123';
const RUN = Date.now().toString(36);
const TAG = `E2E-${RUN}`;

let passed = 0;
let failed = 0;
const failures = [];
const log = (s) => process.stdout.write(s + '\n');

async function test(name, fn) {
  try {
    await fn();
    passed++;
    log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    log(`  FAIL ${name}\n       ${e.message}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg || 'assertion failed');
};
const eq = (a, b, msg) => assert(a === b, `${msg || 'expected equal'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

async function call(method, p, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !form) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${p}`, { method, headers, body: form ? form : body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const get = (p, token) => call('GET', p, { token });
const post = (p, body, token) => call('POST', p, { token, body });
const patch = (p, body, token) => call('PATCH', p, { token, body });
const put = (p, body, token) => call('PUT', p, { token, body });
const del = (p, token, body) => call('DELETE', p, { token, body });
const expectOk = (r, msg) => assert(r.status < 300 && r.data.success !== false, `${msg || 'request failed'} -> ${r.status} ${r.data.message || ''}`);
const expectStatus = (r, s, msg) => eq(r.status, s, msg || `expected HTTP ${s} (${r.data.message || ''})`);

const ctx = {};

async function main() {
  log(`\nSaloonEase E2E against ${API}  (tag ${TAG})\n`);

  // ---------------- Public ----------------
  log('Public endpoints');
  await test('health', async () => expectOk(await get('/health')));
  await test('settings', async () => {
    const r = await get('/settings');
    expectOk(r);
    ctx.settings = r.data.settings;
    assert(ctx.settings.today, 'today missing');
    assert(Array.isArray(ctx.settings.gallery), 'gallery missing');
  });
  await test('services', async () => {
    const r = await get('/services');
    expectOk(r);
    ctx.services = r.data.services;
    assert(ctx.services.length >= 2, 'need at least 2 services seeded');
  });
  await test('barbers', async () => {
    const r = await get('/barbers');
    expectOk(r);
    ctx.barbers = r.data.barbers;
    assert(ctx.barbers.length >= 1, 'need a barber seeded');
  });
  await test('dates', async () => {
    const r = await get('/dates');
    expectOk(r);
    ctx.today = r.data.today;
    ctx.dates = r.data.dates;
    assert(r.data.dates.length >= 2, 'need at least 2 bookable dates');
  });
  await test('slots for tomorrow', async () => {
    ctx.barber = ctx.barbers[0];
    ctx.service = ctx.services[0];
    // pick first upcoming date that is open with free slots
    for (const d of ctx.dates.slice(1)) {
      const r = await get(`/slots?barberId=${ctx.barber._id}&serviceId=${ctx.service._id}&date=${d}`);
      expectOk(r);
      const free = r.data.slots.filter((s) => s.available);
      if (r.data.open && free.length >= 6) {
        ctx.date = d;
        ctx.free = free.map((s) => s.time);
        break;
      }
    }
    assert(ctx.date, 'no open date with free slots found');
  });
  await test('slots validation (bad id -> 400)', async () => expectStatus(await get('/slots?barberId=abc&serviceId=abc&date=2020-01-01'), 400));
  await test('slots past date -> 400', async () => expectStatus(await get(`/slots?barberId=${ctx.barber._id}&serviceId=${ctx.service._id}&date=2020-01-01`), 400));
  await test('public queue (no phone leak)', async () => {
    const r = await get(`/queue?barberId=${ctx.barber._id}&date=${ctx.date}`);
    expectOk(r);
    assert(r.data.queue.waiting.every((w) => w.customerPhone === undefined), 'phone leaked in public queue');
  });

  // ---------------- Auth ----------------
  log('Auth');
  ctx.userA = { name: `${TAG} Aman`, email: `${TAG.toLowerCase()}.a@example.com`, phone: '9000000001', password: 'pass1234' };
  ctx.userB = { name: `${TAG} Bina`, email: `${TAG.toLowerCase()}.b@example.com`, phone: '9000000002', password: 'pass1234' };
  await test('register validation (short password -> 400)', async () => expectStatus(await post('/auth/register', { ...ctx.userA, password: '123' }), 400));
  await test('register user A', async () => {
    const r = await post('/auth/register', ctx.userA);
    expectStatus(r, 201);
    ctx.tokenA = r.data.token;
    eq(r.data.user.role, 'user', 'role');
  });
  await test('register duplicate -> 400/409', async () => assert([400, 409].includes((await post('/auth/register', ctx.userA)).status), 'duplicate allowed'));
  await test('register user B', async () => {
    const r = await post('/auth/register', ctx.userB);
    expectStatus(r, 201);
    ctx.tokenB = r.data.token;
  });
  await test('login wrong password -> 401', async () => expectStatus(await post('/auth/login', { email: ctx.userA.email, password: 'wrong' }), 401));
  await test('login user A', async () => {
    const r = await post('/auth/login', { email: ctx.userA.email, password: ctx.userA.password });
    expectOk(r);
    ctx.tokenA = r.data.token;
  });
  await test('me', async () => {
    const r = await get('/auth/me', ctx.tokenA);
    expectOk(r);
    eq(r.data.user.email, ctx.userA.email);
  });
  await test('me without token -> 401', async () => expectStatus(await get('/auth/me'), 401));
  await test('update profile', async () => {
    const r = await patch('/auth/me', { name: `${TAG} Aman Verma`, phone: '9000000011' }, ctx.tokenA);
    expectOk(r);
    eq(r.data.user.phone, '9000000011');
  });
  await test('change password + login with new', async () => {
    expectOk(await post('/auth/change-password', { currentPassword: 'pass1234', newPassword: 'newpass123' }, ctx.tokenA));
    expectStatus(await post('/auth/login', { email: ctx.userA.email, password: 'pass1234' }), 401);
    const r = await post('/auth/login', { email: ctx.userA.email, password: 'newpass123' });
    expectOk(r);
    ctx.tokenA = r.data.token;
    ctx.userA.password = 'newpass123';
  });
  await test('forgot password -> reset -> login', async () => {
    const r = await post('/auth/forgot-password', { email: ctx.userB.email });
    expectOk(r);
    if (!r.data.devLink) {
      log('       (devLink not returned: SMTP configured or not development; skipping reset step)');
      return;
    }
    const raw = r.data.devLink.split('/').pop();
    const rr = await post(`/auth/reset-password/${raw}`, { password: 'reset12345' });
    expectOk(rr, 'reset failed');
    expectStatus(await post(`/auth/reset-password/${raw}`, { password: 'again12345' }), 400, 'token should be single-use');
    const l = await post('/auth/login', { email: ctx.userB.email, password: 'reset12345' });
    expectOk(l);
    ctx.tokenB = l.data.token;
    ctx.userB.password = 'reset12345';
  });
  await test('forgot password unknown email still 200', async () => expectOk(await post('/auth/forgot-password', { email: 'nobody-' + RUN + '@example.com' })));
  await test('admin login', async () => {
    assert(ADMIN_EMAIL, 'ADMIN_EMAIL / SEED_ADMIN_EMAIL not set');
    const r = await post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expectOk(r, 'admin login');
    eq(r.data.user.role, 'admin', 'admin role');
    ctx.admin = r.data.token;
  });
  await test('user cannot access admin -> 403', async () => expectStatus(await get('/admin/stats', ctx.tokenA), 403));
  await test('anonymous cannot access admin -> 401', async () => expectStatus(await get('/admin/stats'), 401));

  // ---------------- Booking ----------------
  log('Booking & queue');
  const slot = (i) => ctx.free[i];
  await test('booking validation -> 400', async () => expectStatus(await post('/bookings', { barberId: 'x' }, ctx.tokenA), 400));
  await test('user A books slot 1', async () => {
    const r = await post('/bookings', { barberId: ctx.barber._id, serviceId: ctx.service._id, date: ctx.date, slotTime: slot(0), notes: 'fade please' }, ctx.tokenA);
    expectStatus(r, 201);
    ctx.bookA1 = r.data.booking;
    assert(ctx.bookA1.tokenNumber >= ctx.settings.tokenStart, 'token number');
    eq(ctx.bookA1.status, 'waiting');
    eq(ctx.bookA1.price, ctx.service.price, 'price snapshot');
  });
  await test('user B same slot -> 400 (taken)', async () => expectStatus(await post('/bookings', { barberId: ctx.barber._id, serviceId: ctx.service._id, date: ctx.date, slotTime: slot(0) }, ctx.tokenB), 400));
  await test('slot now unavailable', async () => {
    const r = await get(`/slots?barberId=${ctx.barber._id}&serviceId=${ctx.service._id}&date=${ctx.date}`);
    const s = r.data.slots.find((x) => x.time === slot(0));
    eq(s.available, false, 'booked slot still available');
    eq(s.reason, 'booked');
  });
  await test('user B books a later slot', async () => {
    const times = ctx.free.filter((t) => t > slot(0));
    // pick a slot that does not overlap A's service duration
    const [h, m] = slot(0).split(':').map(Number);
    const endA = h * 60 + m + ctx.service.duration;
    ctx.slotB = times.find((t) => {
      const [hh, mm] = t.split(':').map(Number);
      return hh * 60 + mm >= endA;
    });
    const r = await post('/bookings', { barberId: ctx.barber._id, serviceId: ctx.service._id, date: ctx.date, slotTime: ctx.slotB }, ctx.tokenB);
    expectStatus(r, 201);
    ctx.bookB = r.data.booking;
    eq(ctx.bookB.tokenNumber, ctx.bookA1.tokenNumber + 1, 'sequential tokens');
  });
  await test('queue shows A first, B second with positions', async () => {
    const r = await get(`/queue?barberId=${ctx.barber._id}&date=${ctx.date}`);
    const w = r.data.queue.waiting;
    const a = w.find((x) => x.id === ctx.bookA1._id);
    const b = w.find((x) => x.id === ctx.bookB._id);
    assert(a && b, 'both in queue');
    assert(a.position < b.position, 'A before B');
    eq(b.clientsAhead, b.position - 1);
    assert(a.estimatedStart && typeof a.waitMinutes === 'number', 'eta fields');
  });
  await test('get booking with position (owner)', async () => {
    const r = await get(`/bookings/${ctx.bookB._id}`, ctx.tokenB);
    expectOk(r);
    assert(r.data.position && r.data.position.clientsAhead >= 1, 'position');
  });
  await test('get booking of someone else -> 403', async () => expectStatus(await get(`/bookings/${ctx.bookB._id}`, ctx.tokenA), 403));
  await test('max active bookings per client is enforced, then a second booking is allowed', async () => {
    const later = ctx.free.filter((t) => t > ctx.slotB).slice(-3);
    const max = ctx.settings.maxActiveBookingsPerUser;
    if (max < 2) {
      // salon is configured for 1 active booking: verify the block, then raise the limit for the rest of the suite
      expectStatus(await post('/bookings', { barberId: ctx.barber._id, serviceId: ctx.service._id, date: ctx.date, slotTime: later[0] }, ctx.tokenA), 400, 'limit of 1 not enforced');
      expectOk(await patch('/admin/settings', { maxActiveBookingsPerUser: 2 }, ctx.admin));
      ctx.restoreMax = max;
    }
    const r2 = await post('/bookings', { barberId: ctx.barber._id, serviceId: ctx.service._id, date: ctx.date, slotTime: later[0] }, ctx.tokenA);
    expectStatus(r2, 201);
    ctx.bookA2 = r2.data.booking;
    if ((ctx.restoreMax !== undefined ? 2 : max) === 2) {
      expectStatus(await post('/bookings', { barberId: ctx.barber._id, serviceId: ctx.service._id, date: ctx.date, slotTime: later[2] }, ctx.tokenA), 400, 'limit of 2 not enforced');
    }
  });
  await test('my bookings lists upcoming', async () => {
    const r = await get('/bookings/mine', ctx.tokenA);
    expectOk(r);
    assert(r.data.upcoming.some((b) => b._id === ctx.bookA1._id), 'A1 in upcoming');
  });
  await test('cancel booking frees the slot', async () => {
    assert(ctx.bookA2, 'needs second booking');
    const r = await patch(`/bookings/${ctx.bookA2._id}/cancel`, { reason: 'test' }, ctx.tokenA);
    expectOk(r);
    eq(r.data.booking.status, 'cancelled');
    const s = await get(`/slots?barberId=${ctx.barber._id}&serviceId=${ctx.service._id}&date=${ctx.date}`);
    eq(s.data.slots.find((x) => x.time === ctx.bookA2.slotTime).available, true, 'slot not freed');
  });
  await test('cancel twice -> 400', async () => expectStatus(await patch(`/bookings/${ctx.bookA2._id}/cancel`, {}, ctx.tokenA), 400));
  await test('UPI payment claim (no gateway): client submits reference -> verifying -> admin confirms', async () => {
    expectStatus(await patch(`/bookings/${ctx.bookB._id}/payment-claim`, { reference: '12' }, ctx.tokenB), 400, 'short reference');
    expectStatus(await patch(`/bookings/${ctx.bookB._id}/payment-claim`, { reference: '329814567890' }, ctx.tokenA), 403, 'not owner');
    const r = await patch(`/bookings/${ctx.bookB._id}/payment-claim`, { method: 'upi', reference: '329814567890' }, ctx.tokenB);
    expectOk(r);
    eq(r.data.booking.payment.status, 'verifying');
    eq(r.data.booking.payment.reference, '329814567890');
    const list = await get(`/admin/payments?from=${ctx.date}&to=${ctx.date}`, ctx.admin);
    assert(list.data.summary.verifyingCount >= 1, 'verifying bucket');
    const c = await patch(`/admin/bookings/${ctx.bookB._id}/payment`, { status: 'paid', method: 'upi', reference: '329814567890' }, ctx.admin);
    eq(c.data.booking.payment.status, 'paid');
    expectStatus(await patch(`/bookings/${ctx.bookB._id}/payment-claim`, { reference: '329814567890' }, ctx.tokenB), 400, 'already paid');
    // back to pending so later payment tests see the expected totals
    expectOk(await patch(`/admin/bookings/${ctx.bookB._id}/payment`, { status: 'pending', method: null }, ctx.admin));
  });
  await test("cancel someone else's -> 403", async () => expectStatus(await patch(`/bookings/${ctx.bookB._id}/cancel`, {}, ctx.tokenA), 403));

  // ---------------- Admin: queue control ----------------
  log('Admin queue & payments');
  await test('admin stats', async () => {
    const r = await get(`/admin/stats?date=${ctx.date}`, ctx.admin);
    expectOk(r);
    assert(r.data.totals.bookings >= 2, 'stats count');
    assert(Array.isArray(r.data.perBarber), 'perBarber');
  });
  await test('admin walk-in booking (paid cash)', async () => {
    const t = ctx.free.filter((x) => x > ctx.slotB).slice(-1)[0];
    const r = await post('/admin/bookings', { barberId: ctx.barber._id, serviceId: ctx.service._id, date: ctx.date, slotTime: t, customerName: `${TAG} Walkin`, customerPhone: '9000000099', source: 'walk_in', markPaid: true, paymentMethod: 'cash' }, ctx.admin);
    expectStatus(r, 201);
    ctx.walkin = r.data.booking;
    eq(ctx.walkin.payment.status, 'paid');
    eq(ctx.walkin.payment.method, 'cash');
  });
  await test('admin queue includes phone numbers', async () => {
    const r = await get(`/admin/queue?barberId=${ctx.barber._id}&date=${ctx.date}`, ctx.admin);
    expectOk(r);
    const a = r.data.queue.waiting.find((x) => x.id === ctx.bookA1._id);
    assert(a && a.customerPhone, 'phone visible to admin');
  });
  await test('admin list bookings by date + search by token', async () => {
    const r = await get(`/admin/bookings?date=${ctx.date}`, ctx.admin);
    expectOk(r);
    assert(r.data.bookings.some((b) => b._id === ctx.bookB._id), 'B listed');
    const s = await get(`/admin/bookings?search=${ctx.bookB.tokenNumber}`, ctx.admin);
    assert(s.data.bookings.some((b) => b._id === ctx.bookB._id), 'search by token');
    const n = await get(`/admin/bookings?search=${encodeURIComponent(TAG + ' Bina')}`, ctx.admin);
    assert(n.data.bookings.some((b) => b._id === ctx.bookB._id), 'search by name');
  });
  await test('call next moves the first waiting client into the chair', async () => {
    // other (manual / UI-test) bookings may exist on this date, so assert on queue order, not on a specific booking
    const before = (await get(`/admin/queue?barberId=${ctx.barber._id}&date=${ctx.date}`, ctx.admin)).data.queue;
    assert(before.waiting.length >= 2, 'need at least 2 waiting');
    const first = before.waiting[0].id;
    const r = await post(`/admin/barbers/${ctx.barber._id}/call-next`, { date: ctx.date }, ctx.admin);
    expectOk(r);
    eq(r.data.queue.serving?.id, first, 'first waiting now serving');
    if (before.serving) assert(r.data.queue.finished.some((f) => f.id === before.serving.id && f.status === 'done'), 'previous serving marked done');
  });
  await test('call next again: current done, next waiting serving', async () => {
    const before = (await get(`/admin/queue?barberId=${ctx.barber._id}&date=${ctx.date}`, ctx.admin)).data.queue;
    const cur = before.serving.id;
    const next = before.waiting[0].id;
    const r = await post(`/admin/barbers/${ctx.barber._id}/call-next`, { date: ctx.date }, ctx.admin);
    expectOk(r);
    eq(r.data.queue.serving?.id, next, 'next serving');
    assert(r.data.queue.finished.some((f) => f.id === cur && f.status === 'done'), 'current done');
    // make sure A1 is completed for the payment / client-stat checks below
    const a = await get(`/bookings/${ctx.bookA1._id}`, ctx.admin);
    if (a.data.booking.status !== 'done') expectOk(await patch(`/admin/bookings/${ctx.bookA1._id}/status`, { status: 'done' }, ctx.admin));
  });
  await test('mark A paid via UPI', async () => {
    const r = await patch(`/admin/bookings/${ctx.bookA1._id}/payment`, { status: 'paid', method: 'upi', amount: ctx.service.price }, ctx.admin);
    expectOk(r);
    eq(r.data.booking.payment.status, 'paid');
    assert(r.data.booking.payment.paidAt, 'paidAt');
  });
  await test('payments report includes paid amounts by method', async () => {
    const r = await get(`/admin/payments?from=${ctx.date}&to=${ctx.date}`, ctx.admin);
    expectOk(r);
    assert(r.data.summary.paid >= ctx.service.price * 2, 'paid total');
    assert(r.data.summary.byMethod.upi >= ctx.service.price, 'upi bucket');
    assert(r.data.summary.byMethod.cash >= ctx.service.price, 'cash bucket');
  });
  await test('status transitions: B done -> reopen waiting -> no_show', async () => {
    expectOk(await patch(`/admin/bookings/${ctx.bookB._id}/status`, { status: 'done' }, ctx.admin));
    const r = await patch(`/admin/bookings/${ctx.bookB._id}/status`, { status: 'waiting' }, ctx.admin);
    eq(r.data.booking.status, 'waiting');
    const n = await patch(`/admin/bookings/${ctx.bookB._id}/status`, { status: 'no_show', reason: 'late' }, ctx.admin);
    eq(n.data.booking.status, 'no_show');
    eq(n.data.booking.cancelReason, 'late');
    expectOk(await patch(`/admin/bookings/${ctx.bookB._id}/status`, { status: 'waiting' }, ctx.admin));
  });
  await test('reschedule B to another slot / barber', async () => {
    const other = ctx.barbers[1] || ctx.barber;
    const sl = await get(`/slots?barberId=${other._id}&serviceId=${ctx.service._id}&date=${ctx.date}`);
    const t = sl.data.slots.filter((s) => s.available).slice(-1)[0].time;
    const r = await patch(`/admin/bookings/${ctx.bookB._id}`, { barberId: other._id, slotTime: t }, ctx.admin);
    expectOk(r);
    eq(r.data.booking.slotTime, t);
    eq(String(r.data.booking.barber._id), other._id);
  });
  await test('reschedule onto taken slot -> 400', async () => {
    expectStatus(await patch(`/admin/bookings/${ctx.bookB._id}`, { barberId: ctx.barber._id, slotTime: ctx.walkin.slotTime }, ctx.admin), 400);
  });

  // ---------------- Availability ----------------
  log('Availability');
  const far = ctx.dates[ctx.dates.length - 1];
  await test('month overview', async () => {
    const r = await get(`/admin/availability/month?barberId=${ctx.barber._id}&month=${ctx.date.slice(0, 7)}`, ctx.admin);
    expectOk(r);
    assert(r.data.days.find((d) => d.date === ctx.date)?.activeBookings >= 1, 'bookings counted');
  });
  await test('block a slot -> unavailable -> booking rejected', async () => {
    const sl = await get(`/slots?barberId=${ctx.barber._id}&serviceId=${ctx.service._id}&date=${far}`);
    assert(sl.data.open, 'far date closed');
    const t = sl.data.slots.find((s) => s.available).time;
    expectOk(await put('/admin/availability/day', { barberId: ctx.barber._id, date: far, blockedSlots: [t], note: TAG }, ctx.admin));
    const after = await get(`/slots?barberId=${ctx.barber._id}&serviceId=${ctx.service._id}&date=${far}`);
    eq(after.data.slots.find((s) => s.time === t).reason, 'blocked');
    expectStatus(await post('/bookings', { barberId: ctx.barber._id, serviceId: ctx.service._id, date: far, slotTime: t }, ctx.tokenB), 400);
    ctx.blockedDate = far;
  });
  await test('day detail shows override', async () => {
    const r = await get(`/admin/availability/day?barberId=${ctx.barber._id}&date=${far}`, ctx.admin);
    expectOk(r);
    eq(r.data.override.blockedSlots.length, 1);
  });
  await test('day off -> closed -> booking rejected', async () => {
    expectOk(await put('/admin/availability/day', { barberId: ctx.barber._id, date: far, isOff: true, note: TAG }, ctx.admin));
    const sl = await get(`/slots?barberId=${ctx.barber._id}&serviceId=${ctx.service._id}&date=${far}`);
    eq(sl.data.open, false);
    expectStatus(await post('/bookings', { barberId: ctx.barber._id, serviceId: ctx.service._id, date: far, slotTime: '12:00' }, ctx.tokenB), 400);
  });
  await test('custom hours validation (start >= end -> 400)', async () => expectStatus(await put('/admin/availability/day', { barberId: ctx.barber._id, date: far, isOff: false, start: '15:00', end: '12:00' }, ctx.admin), 400));
  await test('clear override -> open again', async () => {
    expectOk(await del(`/admin/availability/day?barberId=${ctx.barber._id}&date=${far}`, ctx.admin));
    eq((await get(`/slots?barberId=${ctx.barber._id}&serviceId=${ctx.service._id}&date=${far}`)).data.open, true);
  });

  // ---------------- Catalog ----------------
  log('Services & barbers');
  await test('create / update / hide service', async () => {
    const r = await post('/admin/services', { name: `${TAG} Service`, price: 99, duration: 20, popular: true }, ctx.admin);
    expectStatus(r, 201);
    ctx.svc = r.data.service;
    const u = await patch(`/admin/services/${ctx.svc._id}`, { price: 120, active: false }, ctx.admin);
    eq(u.data.service.price, 120);
    const pub = await get('/services');
    assert(!pub.data.services.some((s) => s._id === ctx.svc._id), 'hidden service exposed publicly');
  });
  await test('service validation (duration < 5 -> 400)', async () => expectStatus(await post('/admin/services', { name: 'x', price: 1, duration: 1 }, ctx.admin), 400));
  await test('delete service in use -> 400, unused -> ok', async () => {
    expectStatus(await del(`/admin/services/${ctx.service._id}`, ctx.admin), 400, 'service with active bookings deleted');
    expectOk(await del(`/admin/services/${ctx.svc._id}`, ctx.admin));
    ctx.svc = null;
  });
  await test('create / update / delete barber', async () => {
    const r = await post('/admin/barbers', { name: `${TAG} Barber`, title: 'Trainee', workingHours: { start: '11:00', end: '18:00' }, weeklyOff: [2] }, ctx.admin);
    expectStatus(r, 201);
    ctx.newBarber = r.data.barber;
    const sl = await get(`/slots?barberId=${ctx.newBarber._id}&serviceId=${ctx.service._id}&date=${ctx.date}`);
    if (sl.data.open) assert(sl.data.slots[0].time === '11:00', `barber hours override not applied (${sl.data.slots[0]?.time})`);
    expectOk(await patch(`/admin/barbers/${ctx.newBarber._id}`, { active: false }, ctx.admin));
    expectOk(await del(`/admin/barbers/${ctx.newBarber._id}`, ctx.admin));
    ctx.newBarber = null;
  });
  await test('delete barber with active booking: refused, then force cancels & deletes', async () => {
    const r = await post('/admin/barbers', { name: `${TAG} Busy Barber`, workingHours: { start: '11:00', end: '18:00' } }, ctx.admin);
    const b = r.data.barber;
    const sl = await get(`/slots?barberId=${b._id}&serviceId=${ctx.service._id}&date=${ctx.date}`);
    const t = sl.data.slots.find((s) => s.available).time;
    const bk = await post('/admin/bookings', { barberId: b._id, serviceId: ctx.service._id, date: ctx.date, slotTime: t, customerName: `${TAG} Busy`, source: 'walk_in' }, ctx.admin);
    expectStatus(bk, 201);
    const usage = await get(`/admin/barbers/${b._id}/usage`, ctx.admin);
    eq(usage.data.active, 1, 'usage active');
    expectStatus(await del(`/admin/barbers/${b._id}`, ctx.admin), 400, 'should refuse without force');
    const forced = await del(`/admin/barbers/${b._id}?force=true`, ctx.admin);
    expectOk(forced);
    eq(forced.data.cancelledBookings, 1, 'cancelled count');
    const after = await get(`/bookings/${bk.data.booking._id}`, ctx.admin);
    eq(after.data.booking.status, 'cancelled');
    eq(after.data.booking.cancelReason, 'Barber removed');
    // link/unlink an admin account to a barber
    const nb = await post('/admin/barbers', { name: `${TAG} Linked`, userId: ctx.userBId || undefined }, ctx.admin);
    expectStatus(nb, 201);
    expectOk(await patch(`/admin/barbers/${nb.data.barber._id}`, { userId: null }, ctx.admin));
    expectOk(await del(`/admin/barbers/${nb.data.barber._id}`, ctx.admin));
  });
  await test('admin can permanently delete a booking', async () => {
    const r = await del(`/admin/bookings/${ctx.bookA2._id}`, ctx.admin);
    expectOk(r);
    expectStatus(await get(`/bookings/${ctx.bookA2._id}`, ctx.admin), 404);
  });

  // ---------------- Settings & content ----------------
  log('Settings & content');
  await test('patch settings + revert', async () => {
    const r = await patch('/admin/settings', { tagline: `${TAG} tagline` }, ctx.admin);
    expectOk(r);
    eq(r.data.settings.tagline, `${TAG} tagline`);
    expectOk(await patch('/admin/settings', { tagline: ctx.settings.tagline }, ctx.admin));
  });
  await test('settings validation (open >= close -> 400)', async () => expectStatus(await patch('/admin/settings', { openTime: '20:00', closeTime: '10:00' }, ctx.admin), 400));
  await test('gallery add / patch / remove', async () => {
    const r = await post('/admin/settings/gallery', { items: [{ url: 'https://example.com/e2e.jpg', publicId: `e2e/${RUN}`, category: 'style', caption: TAG }] }, ctx.admin);
    expectOk(r);
    const item = r.data.gallery.find((g) => g.caption === TAG);
    assert(item, 'gallery item added');
    const p = await patch(`/admin/settings/gallery/${item._id}`, { category: 'demo', caption: `${TAG} demo` }, ctx.admin);
    eq(p.data.gallery.find((g) => g._id === item._id).category, 'demo');
    const d = await del(`/admin/settings/gallery/${item._id}`, ctx.admin);
    assert(!d.data.gallery.some((g) => g._id === item._id), 'gallery item not removed');
  });
  await test('upload without file -> 400', async () => {
    const fd = new FormData();
    const r = await call('POST', '/admin/upload?folder=e2e', { token: ctx.admin, form: fd });
    assert([400, 500].includes(r.status) && r.status !== 201, 'upload accepted empty form');
  });
  await test('real Cloudinary upload + delete', async () => {
    const png = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'public', 'icons', 'icon-192.png');
    if (!existsSync(png) || !process.env.CLOUDINARY_API_KEY) {
      log('       (skipped: no icon file or Cloudinary not configured)');
      return;
    }
    const fd = new FormData();
    fd.append('files', new Blob([readFileSync(png)], { type: 'image/png' }), 'e2e.png');
    const r = await call('POST', '/admin/upload?folder=e2e', { token: ctx.admin, form: fd });
    expectStatus(r, 201, 'upload');
    assert(r.data.file.url.startsWith('https://res.cloudinary.com/'), 'cloudinary url');
    expectOk(await del('/admin/upload', ctx.admin, { publicId: r.data.file.publicId }));
  });

  // ---------------- Clients ----------------
  log('Clients');
  await test('list + search clients', async () => {
    const r = await get(`/admin/clients?search=${encodeURIComponent(TAG)}`, ctx.admin);
    expectOk(r);
    assert(r.data.clients.some((c) => c.email === ctx.userA.email), 'A listed');
    const a = r.data.clients.find((c) => c.email === ctx.userA.email);
    assert(a.stats.total >= 1 && a.stats.done >= 1 && a.stats.spent >= ctx.service.price, `client stats ${JSON.stringify(a.stats)}`);
    ctx.userAId = a.id;
    ctx.userBId = r.data.clients.find((c) => c.email === ctx.userB.email).id;
  });
  await test('client detail with bookings', async () => {
    const r = await get(`/admin/clients/${ctx.userAId}`, ctx.admin);
    expectOk(r);
    assert(r.data.bookings.length >= 1 && r.data.bookings.some((b) => b._id === ctx.bookA1._id), 'bookings history');
  });
  await test('block client -> cannot login or use token; unblock', async () => {
    expectOk(await patch(`/admin/clients/${ctx.userAId}`, { isBlocked: true }, ctx.admin));
    expectStatus(await post('/auth/login', { email: ctx.userA.email, password: ctx.userA.password }), 401);
    expectStatus(await get('/auth/me', ctx.tokenA), 403);
    expectOk(await patch(`/admin/clients/${ctx.userAId}`, { isBlocked: false }, ctx.admin));
    expectOk(await get('/auth/me', ctx.tokenA));
  });
  await test('promote client to admin and back', async () => {
    expectOk(await patch(`/admin/clients/${ctx.userBId}`, { role: 'admin' }, ctx.admin));
    const l = await post('/auth/login', { email: ctx.userB.email, password: ctx.userB.password });
    eq(l.data.user.role, 'admin');
    expectOk(await get('/admin/stats', l.data.token));
    expectOk(await patch(`/admin/clients/${ctx.userBId}`, { role: 'user' }, ctx.admin));
  });
  await test('quick-create walk-in client by phone', async () => {
    const r = await post('/admin/clients/quick', { name: `${TAG} Guest`, phone: '9000000777' }, ctx.admin);
    expectOk(r);
    ctx.guestId = r.data.client.id;
    const again = await post('/admin/clients/quick', { name: 'ignored', phone: '9000000777' }, ctx.admin);
    eq(again.data.client.id, ctx.guestId, 'should reuse by phone');
  });
  // ---------------- Notifications & push ----------------
  log('Notifications & push');
  await test('admin feed contains booking / cancel / payment / registration events', async () => {
    const r = await get('/admin/notifications?limit=100', ctx.admin);
    expectOk(r);
    const types = r.data.notifications.map((n) => n.type);
    for (const t of ['booking_created', 'booking_cancelled', 'payment_claimed', 'client_registered']) assert(types.includes(t), `missing ${t} notification`);
    const mine = r.data.notifications.find((n) => n.type === 'booking_created' && n.title.includes(`#${ctx.bookA1.tokenNumber}`));
    assert(mine && mine.data.url.startsWith('/admin/bookings?'), 'deep link url');
    assert(typeof r.data.unreadCount === 'number' && r.data.unreadCount >= 1, 'unread count');
    assert(typeof r.data.pushConfigured === 'boolean', 'pushConfigured flag');
    ctx.noteIds = r.data.notifications.filter((n) => !n.read).slice(0, 2).map((n) => n._id);
  });
  await test('mark some read, then all read', async () => {
    if (!ctx.noteIds?.length) {
      const r0 = await get('/admin/notifications?limit=100', ctx.admin);
      ctx.noteIds = r0.data.notifications.filter((n) => !n.read).slice(0, 2).map((n) => n._id);
    }
    if (ctx.noteIds.length) {
      const r = await post('/admin/notifications/read', { ids: ctx.noteIds }, ctx.admin);
      expectOk(r);
      const after = await get('/admin/notifications?limit=100', ctx.admin);
      assert(after.data.notifications.filter((n) => ctx.noteIds.includes(n._id)).every((n) => n.read), 'ids not marked read');
    }
    expectStatus(await post('/admin/notifications/read', {}, ctx.admin), 400, 'empty body should be rejected');
    expectOk(await post('/admin/notifications/read', { all: true }, ctx.admin));
    eq((await get('/admin/notifications?limit=1', ctx.admin)).data.unreadCount, 0, 'unread after mark all');
  });
  await test('test notification + since filter', async () => {
    const since = new Date().toISOString();
    expectOk(await post('/admin/notifications/test', {}, ctx.admin));
    const r = await get(`/admin/notifications?since=${encodeURIComponent(since)}`, ctx.admin);
    assert(r.data.notifications.some((n) => n.title === 'Test notification'), 'test notification not listed');
  });
  await test('notifications are admin-only', async () => {
    expectStatus(await get('/admin/notifications', ctx.tokenA), 403);
  });
  await test('push: public key, subscribe (validation + upsert), unsubscribe', async () => {
    const k = await get('/push/public-key');
    expectOk(k);
    if (!k.data.configured) {
      log('       (push not configured: skipping subscribe)');
      return;
    }
    assert(k.data.publicKey.length > 20, 'public key');
    expectStatus(await post('/push/subscribe', { subscription: { endpoint: 'nope' } }, ctx.admin), 400);
    const sub = { endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${RUN}`, keys: { p256dh: 'BPk3f2Y2e2cX2bYyU2dY0lQ4q5cXx0M4v7w3t3K1x6E', auth: 'abcdefghijklmnop' } };
    const s = await post('/push/subscribe', { subscription: sub, userAgent: 'e2e' }, ctx.admin);
    expectStatus(s, 201);
    const again = await post('/push/subscribe', { subscription: sub, userAgent: 'e2e' }, ctx.admin);
    eq(again.data.devices, s.data.devices, 'upsert should not add a device');
    // sending to a fake endpoint must not break notification creation
    expectOk(await post('/admin/notifications/test', {}, ctx.admin));
    expectOk(await del('/push/subscribe', ctx.admin, { endpoint: sub.endpoint }));
  });
  await test('unknown route -> 404', async () => expectStatus(await get('/nope'), 404));

  if (ctx.restoreMax !== undefined) {
    await test(`restore maxActiveBookingsPerUser = ${ctx.restoreMax}`, async () => expectOk(await patch('/admin/settings', { maxActiveBookingsPerUser: ctx.restoreMax }, ctx.admin)));
  }
}

async function cleanup() {
  log('\nCleanup');
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const loose = (n) => mongoose.model(n, new mongoose.Schema({}, { strict: false }), n.toLowerCase() + 's');
    const User = loose('User');
    const Booking = loose('Booking');
    const Service = loose('Service');
    const Barber = loose('Barber');
    const Availability = loose('Availability');
    // this run's data + anything left behind by the browser UI test (e2e-ui.*)
    const users = await User.find({ email: new RegExp(`^(${TAG.toLowerCase()}|e2e-ui\\.)`) }).select('_id');
    const ids = users.map((u) => u._id);
    const b = await Booking.deleteMany({ $or: [{ user: { $in: ids } }, { customerName: new RegExp(`^(${TAG}|E2E-UI)`) }] });
    const u = await User.deleteMany({ $or: [{ _id: { $in: ids } }, { name: new RegExp(`^(${TAG}|E2E-UI)`) }] });
    const s = await Service.deleteMany({ name: new RegExp(`^${TAG}`) });
    const br = await Barber.deleteMany({ name: new RegExp(`^${TAG}`) });
    const av = await Availability.deleteMany({ note: TAG });
    log(`  removed bookings=${b.deletedCount} users=${u.deletedCount} services=${s.deletedCount} barbers=${br.deletedCount} availability=${av.deletedCount}`);
    await mongoose.disconnect();
  } catch (e) {
    log('  cleanup failed: ' + e.message);
  }
}

main()
  .catch((e) => {
    failed++;
    failures.push({ name: 'suite', error: e.message });
    log('SUITE ERROR ' + e.stack);
  })
  .finally(async () => {
    await cleanup();
    log(`\n${passed} passed, ${failed} failed`);
    if (failures.length) {
      log('\nFailures:');
      failures.forEach((f) => log(`  - ${f.name}: ${f.error}`));
    }
    process.exit(failed ? 1 : 0);
  });
