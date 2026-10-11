// Browser end-to-end run of the SaloonEase PWA on a phone viewport (puppeteer-core + installed Chrome).
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN = { email: process.env.ADMIN_EMAIL || 'rajpramanik@gmail.com', password: process.env.ADMIN_PASSWORD || 'admin123' };
const RUN = Date.now().toString(36);
const USER = { name: `E2E-UI ${RUN}`, email: `e2e-ui.${RUN}@example.com`, phone: '9000001234', password: 'uipass123' };
const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });

let passed = 0, failed = 0;
const fails = [];
const log = (s) => console.log(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--window-size=390,844'],
});
const page = await browser.newPage();
await page.emulate({
  viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
page.setDefaultTimeout(30000);
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`); });

const shot = (name, full = false) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });
const goto = async (p) => { await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle2' }); };
const textExists = (t) => page.evaluate((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), t);
const waitText = async (t, timeout = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await textExists(t)) return true;
    await sleep(250);
  }
  throw new Error(`text not found: "${t}"`);
};
const clickText = async (t, tag = 'button, a, label, div[role=button]') => {
  const ok = await page.evaluate((t, tag) => {
    const els = Array.from(document.querySelectorAll(tag)).filter((e) => e.innerText && e.innerText.trim().toLowerCase().includes(t.toLowerCase()) && !e.disabled);
    const el = els.sort((a, b) => a.innerText.length - b.innerText.length)[0];
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, t, tag);
  if (!ok) throw new Error(`clickable not found: "${t}"`);
};
// Type into a controlled React input and verify it stuck (hydration can reset early keystrokes).
const type = async (sel, val) => {
  await page.waitForSelector(sel);
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.click(sel, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(sel, val, { delay: 5 });
    await sleep(150);
    const got = await page.$eval(sel, (e) => e.value);
    if (got === val) return;
    await sleep(500);
  }
  throw new Error(`could not type into ${sel}`);
};

async function test(name, fn) {
  try { await fn(); passed++; log(`  ok   ${name}`); }
  catch (e) { failed++; fails.push({ name, error: e.message }); log(`  FAIL ${name}\n       ${e.message}`); try { await shot(`FAIL-${name.replace(/\W+/g, '_')}`); } catch {} }
}

let token = null;
log(`\nBrowser E2E on ${BASE} (${USER.email})\n`);

await test('home page renders hero, live band, barbers, services, lookbook, shop', async () => {
  await goto('/');
  await waitText('Look sharp');
  await waitText('Services & pricing');
  await waitText('Meet your barbers');
  await waitText('The shop');
  await page.waitForSelector('a[href^="/book?serviceId="]');
  await waitText('Cut designs');
  await page.waitForFunction(() => Array.from(document.images).filter((i) => i.src.includes('unsplash') || i.src.includes('cloudinary')).length >= 6);
  await page.waitForFunction(() => Array.from(document.images).filter((i) => i.src.includes('unsplash') || i.src.includes('cloudinary')).slice(0, 8).every((i) => i.complete), { timeout: 60000 }).catch(() => {});
  await sleep(500);
  await shot('01-home-top');
  await shot('01-home-full', true);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (horizontalOverflow) throw new Error('page has horizontal overflow on 390px');
});

await test('lightbox opens from lookbook', async () => {
  await waitText('Cut designs');
  await page.waitForFunction(() => Array.from(document.querySelectorAll('section')).some((s) => /cut designs/i.test(s.innerText) && s.querySelector('button img')));
  const opened = await page.evaluate(() => {
    const section = Array.from(document.querySelectorAll('section')).find((s) => /cut designs/i.test(s.innerText));
    const target = section?.querySelector('button img');
    if (!target) return false;
    target.closest('button').scrollIntoView({ block: 'center' });
    target.closest('button').click();
    return true;
  });
  if (!opened) throw new Error('no lookbook image found');
  await sleep(400);
  await shot('02-lightbox');
  await page.keyboard.press('Escape');
});

await test('register new client', async () => {
  await goto('/register');
  await type('input[placeholder="e.g. Aman Verma"]', USER.name);
  await type('input[type="email"]', USER.email);
  await type('input[type="tel"]', USER.phone);
  const pw = await page.$$('input[type="password"]');
  await pw[0].type(USER.password);
  await pw[1].type(USER.password);
  await shot('03-register');
  await clickText('Create account');
  await page.waitForFunction(() => location.pathname === '/book', { timeout: 30000 });
});

await test('book a slot and receive a token', async () => {
  await waitText('Select barber');
  await waitText('Select service');
  // choose tomorrow (second date pill) to be safe late in the day
  await page.waitForFunction(() => document.querySelectorAll('button span.text-lg.font-extrabold').length >= 2);
  await page.evaluate(() => document.querySelectorAll('button span.text-lg.font-extrabold')[1].closest('button').click());
  await sleep(1500);
  // first enabled slot button inside the grid
  const picked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /^\d{1,2}:\d{2} (AM|PM)$/.test(b.innerText.trim()) && !b.disabled);
    if (!btn) return null;
    btn.click();
    return btn.innerText.trim();
  });
  if (!picked) throw new Error('no available slot button');
  await shot('04-book-form', true);
  await clickText('Confirm & Generate Token');
  await waitText('Token Reserved!');
  token = await page.evaluate(() => (document.body.innerText.match(/#(\d{3,})/) || [])[1]);
  if (!token) throw new Error('token number not shown');
  await shot('05-token-success');
  await clickText('Track in Live Queue');
  await page.waitForFunction(() => location.pathname === '/dashboard');
});

await test('dashboard shows my upcoming booking', async () => {
  await waitText('My Upcoming');
  await waitText(`#${token}`);
  await shot('06-dashboard', true);
});

await test('profile page and logout', async () => {
  await goto('/profile');
  await waitText(USER.name);
  await shot('07-profile');
  await clickText('Logout');
  await page.waitForFunction(() => location.pathname === '/');
});

await test('protected route redirects to login', async () => {
  await goto('/book');
  await page.waitForFunction(() => location.pathname === '/login');
});

await test('admin login lands on Today', async () => {
  await goto('/login');
  await type('input[type="email"]', ADMIN.email);
  await type('input[type="password"]', ADMIN.password);
  await clickText('Login', 'button');
  await page.waitForFunction(() => location.pathname === '/admin', { timeout: 30000 });
  await waitText('Revenue today');
  await waitText('Call next client');
  await shot('08-admin-today', true);
});

await test('admin bookings: find token, start service, complete, mark paid', async () => {
  await goto('/admin/bookings');
  await waitText('Bookings');
  // search by the unique client name across dates (token numbers repeat per day)
  await type('input[placeholder^="Search name"]', USER.name);
  await waitText(`#${token}`);
  await waitText(USER.name);
  await shot('09-admin-bookings');
  const openRow = () => clickText(USER.name, 'button');
  await openRow();
  await waitText('Start service');
  await shot('10-admin-booking-actions');
  await clickText('Start service');
  await waitText('Client is now in chair');
  await sleep(800);
  await openRow();
  await waitText('Complete service');
  await clickText('Complete service');
  await waitText('Service completed');
  await sleep(800);
  await openRow();
  await waitText('Mark as paid');
  await clickText('Mark as paid');
  await waitText('Confirm paid');
  await clickText('UPI', 'button');
  await clickText('Confirm paid');
  await waitText('Paid');
  await sleep(600);
  await shot('11-admin-booking-paid');
});

await test('admin walk-in booking sheet opens', async () => {
  await goto('/admin');
  await waitText('Walk-in / book');
  await clickText('Walk-in / book');
  await waitText('Book for a client');
  await waitText('Create token');
  await shot('12-admin-walkin-sheet');
  await page.keyboard.press('Escape');
});

await test('admin calendar renders month grid and day sheet', async () => {
  await goto('/admin/availability');
  await waitText('Days off, hours & blocked slots');
  await page.waitForSelector('button.aspect-square');
  await shot('13-admin-calendar');
  const clicked = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('button.aspect-square')).filter((b) => !b.className.includes('opacity-50'));
    const c = cells[cells.length - 1];
    if (!c) return false;
    c.click();
    return true;
  });
  if (!clicked) throw new Error('no day cell');
  await waitText('Day off');
  await waitText('Block slots');
  await shot('14-admin-day-sheet');
  await page.keyboard.press('Escape');
});

await test('admin payments, services, barbers, content, settings, clients pages render', async () => {
  await goto('/admin/payments'); await waitText('Collected');
  await clickText('Custom', 'button');
  // widen the range to include tomorrow's booking
  const dates = await page.$$('input[type="date"]');
  const far = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  await dates[1].evaluate((el, v) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, far);
  await waitText(`#${token}`);
  await shot('15-admin-payments');
  await goto('/admin/services'); await waitText('Hair Cut'); await shot('16-admin-services');
  await goto('/admin/barbers'); await waitText('Ramesh'); await shot('17-admin-barbers');
  await goto('/admin/content'); await waitText('Home page photos & videos'); await shot('18-admin-content', true);
  await goto('/admin/settings'); await waitText('Working hours'); await shot('19-admin-settings');
  await goto('/admin/clients'); await waitText(USER.name); await shot('20-admin-clients');
  await clickText(USER.name, 'a');
  await waitText('Booking history');
  await waitText(`#${token}`);
  await shot('21-admin-client-detail');
});

await test('admin more + view as client + forgot password page', async () => {
  await goto('/admin/more');
  await waitText('Services & prices');
  await shot('22-admin-more');
  await goto('/forgot-password');
  await waitText('Send reset link');
  await shot('23-forgot');
  await goto('/offline');
  await waitText('You are offline');
});

await test('PWA manifest and service worker are served', async () => {
  const m = await page.evaluate(async () => (await fetch('/manifest.json')).status);
  const s = await page.evaluate(async () => { const r = await fetch('/sw.js'); return [r.status, r.headers.get('content-type') || '']; });
  if (m !== 200) throw new Error('manifest ' + m);
  if (s[0] !== 200 || !/javascript/.test(s[1])) throw new Error('sw.js ' + s.join(' '));
  const icon = await page.evaluate(async () => (await fetch('/icons/icon-192.png')).status);
  if (icon !== 200) throw new Error('icon ' + icon);
});

await browser.close();
const realErrors = consoleErrors.filter((e) => !/favicon|Failed to load resource.*(404|401|400)|hydrat/i.test(e));
log(`\n${passed} passed, ${failed} failed`);
if (fails.length) { log('Failures:'); fails.forEach((f) => log(`  - ${f.name}: ${f.error}`)); }
if (realErrors.length) { log(`\nBrowser console errors (${realErrors.length}):`); realErrors.slice(0, 15).forEach((e) => log('  ' + e.slice(0, 300))); }
log(`\nScreenshots: ${SHOTS}`);
process.exit(failed ? 1 : 0);
