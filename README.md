# SaloonEase - Salon Queue & Slot Booking (PWA)

Mobile-first salon management app. Clients book a slot, get a token and track their live turn.
Barbers (admins) run the day from the same app: queue control, bookings on behalf of clients,
payments, prices, content, availability calendar and clients.

| Part | Stack | Folder |
| --- | --- | --- |
| Frontend (PWA) | Next.js 14 (App Router), TypeScript, Tailwind, lucide-react | `client/` |
| Backend API | Node 18+, Express, Mongoose, JWT, zod, Cloudinary, Nodemailer | `server/` |
| Database | MongoDB Atlas (free M0 works) | - |
| Media | Cloudinary (images & videos) | - |

The original HTML mock-up is kept at `saloonease_pwa.html` for reference.

---

## 1. Run locally

```bash
# API
cd server
cp .env.example .env        # already created with your Mongo URI
npm install
npm run seed                 # creates settings, services, barbers and the admin user
npm run dev                  # http://localhost:5000/api/health

# Client (new terminal)
cd client
npm install
npm run dev                  # http://localhost:3000
```

The seed creates the first admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `server/.env` (never commit that file).
Change the password from **Profile -> Change password** after first login.

### How admins work
There is no separate admin app. Everyone logs in at `/login`.
An account is an admin when **either**:
- its email is listed in `ADMIN_EMAILS` (comma separated) in `server/.env`, or
- an existing admin promotes it from **Admin -> More -> Clients -> client -> Make admin**.

Admins land on `/admin`; clients land on `/`. Admins can still use the client side ("View app as client").

### Test on your phone (same Wi-Fi)
1. Find your PC IP (`ipconfig`, e.g. `192.168.1.5`).
2. `client/.env.local` -> `NEXT_PUBLIC_API_URL=http://192.168.1.5:5000/api`, restart `npm run dev`.
3. Open `http://192.168.1.5:3000` on the phone. Install prompt appears in Chrome; on iPhone use Share -> Add to Home Screen.
   (Service worker install requires HTTPS or localhost; on a LAN IP the app still works, it just will not cache offline.)

---

## 2. Features

**Client**
- Home: hero, announcement, live wait stats, services & rates, barbers, gallery, contact (call / WhatsApp / maps)
- Account: register with email + password, login, forgot password (email link, 30 min), change password, profile
- Booking: pick barber, service, date (today + N days), live available slots, note; token generated instantly, confirmation email
- Live queue dashboard: now-in-chair, your position, clients ahead, estimated start, whole-day queue per barber, auto refresh
- My bookings: upcoming (cancel) and past visits
- PWA: installable, offline fallback page, update prompt, app shortcuts

**Admin (barber)**
- Today: revenue, unpaid, waiting, completed; per-barber queue; **Done & call next**; walk-in booking; tap any token for actions
- Booking actions: start / complete / no-show / cancel / reopen, mark paid (cash, UPI, card, online), reschedule or change barber, call / WhatsApp client
- Bookings: by date, barber, status; search by name, phone or token across all dates; book on behalf of a client
- Calendar (availability): month view, day off, custom hours per day, block individual slots (lunch, breaks), notes
- Payments: collected / due / upcoming for today, 7 days, month or custom range; by method; mark paid from the list
- Services & prices: add, edit, hide, delete, popular badge, "was" price, image
- Barbers: profiles, photo, title, bio, working hours override, weekly off, link to an admin login
- Content: logo, hero image, gallery photos & videos (Cloudinary), announcement banner, contact details
- Salon settings: open/close time, weekly off, slot size, book-ahead days, token start number, online booking on/off, max active bookings per client, timezone
- Clients: list with visits / spent / no-shows, detail with history, block / unblock, make admin

**Logo & app icons**
1. Save the salon logo as `client/public/brand/logo.png` (square or circular, at least 512 px).
2. `cd client && npm run icons` - generates all PWA icons, Apple touch icon, favicons and `brand/logo-512.png`, and sets the manifest name from `NEXT_PUBLIC_APP_NAME`.
3. Bump `VERSION` in `client/public/sw.js` so phones that already installed the app refresh their icon.
The logo file is used automatically in the header, login/register screens, 404 page, install banner, and email headers. Uploading a logo in Admin -> Content overrides it inside the app.

**QR code & shop card**
- Admin -> More -> **QR code & shop card**: download the booking QR (PNG), share the link, and design a printable shop card
  (logo, name, tagline, hours, address, phone, QR; Classic / Dark / Emerald styles; 1080 x 1440 PNG, print button).
- The QR encodes **Salon settings -> Website URL** (set to your live Vercel URL) so it also works when generated on localhost.

**Speed on free hosting**
- The client renders instantly from cached data (services, barbers, settings, your profile) and refreshes in the background; a thin progress bar shows activity.
- If the API sleeps (Render free tier sleeps after 15 min idle), the first request can take 30-60 s; the app shows "Waking up the server". To avoid it, deploy the API to Vercel serverless (`server/vercel.json`) or ping `/api/health` every 10 minutes with a free monitor such as cron-job.org or UptimeRobot.
- `npm run dev` is slow by design (compiles on demand). Always judge speed on the deployed build or `npm run build && npm start`.

**Payments without a gateway (UPI)**
- Admin -> More -> Content -> Contact -> enter the salon's **UPI ID**. Clients then see "Pay now via UPI" on the booking form, in the token popup and on Live Queue.
- The client gets a QR code and an "Open UPI app" button with the amount prefilled (GPay, PhonePe, Paytm, BHIM), pays, and enters the UPI reference / UTR.
- The booking shows **UPI - verify** for the barber; open it and tap **Confirm received** (after matching the bank SMS) or **Not received**. Payments -> "To verify" lists all pending ones.
- Leave the UPI ID empty to offer "Pay at salon" only.

**Admin notifications (new booking, cancellation, UPI payment, new client)**
- In-app: the bell in the admin header polls every few seconds, shows a bubble + unread badge and plays `public/sounds/notify.wav`. Sound can be muted from the bell sheet.
- Phone push (works when the app is closed): bell -> **Enable** on each barber's phone. Needs `VAPID_*` keys in `server/.env`
  (`npx web-push generate-vapid-keys`). Android Chrome works in the browser; iPhone needs the PWA installed to the Home Screen first (iOS 16.4+).
- Works on Vercel/Netlify/Render: push is plain HTTPS from the API to Google/Apple push services, and the in-app part uses polling (no WebSockets needed).
- Bell -> **Send test** verifies sound and push on the current device.

**Deleting things**
- Booking: open it (Today, Bookings, Payments or client page) -> use **Cancel** / **No show** to keep history, or **Delete this booking permanently** at the bottom of the sheet.
- Barber: More -> Barbers -> trash icon. If the barber still has waiting or in-chair bookings the dialog offers to cancel them and remove the barber (clients see "Barber removed"); to keep those bookings, reschedule them to another barber first or mark the barber inactive instead.
- Unlink a barber from a login: edit the barber -> **Admin login account** -> "Not linked". Deleting a barber never deletes the user account.
- Service: trash icon; services with active bookings must be hidden instead (history keeps the price snapshot).

---

## 3. Tests (end to end)

Both suites run against live servers (`npm run dev` in `server/` and `client/`) and clean up the data they create.

```bash
# API: 71 checks across auth, booking, queue, admin actions, availability, catalog, content, clients, uploads, permissions
cd server && npm run test:e2e

# Browser: drives the real UI in headless Chrome on a 390x844 phone viewport and saves screenshots to client/tests/shots
cd client && npm run test:ui          # needs Google Chrome installed; set CHROME=<path> if it is not in the default location
```

Both read the admin login from `server/.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`); override with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `API_URL`, `BASE_URL`.
The Cloudinary upload check is skipped when Cloudinary is not configured and fails if the API key cannot upload (see Cloudinary note below).

## 4. Deploy for free

### Frontend -> Vercel (recommended) or Netlify
1. Push this folder to GitHub.
2. Vercel -> **New Project** -> import repo -> **Root Directory: `client`** (framework auto-detected: Next.js).
3. Environment variable: `NEXT_PUBLIC_API_URL = https://<your-api-domain>/api`.
4. Deploy. You get `https://<app>.vercel.app`. Netlify works the same way (base directory `client`, Next.js runtime auto-detected).

### Backend -> pick one
**Option A: Render (always-on style, free tier sleeps after 15 min idle)**
1. Render -> **New -> Blueprint** -> select repo (uses `render.yaml`, root dir `server`).
2. Fill `MONGO_URI`, `CLIENT_URL` (your Vercel URL), `ADMIN_EMAILS`, Cloudinary and SMTP values.
3. API URL: `https://saloonease-api.onrender.com/api`.

**Option B: Vercel serverless (same account as the frontend)**
1. Vercel -> **New Project** -> same repo -> **Root Directory: `server`**.
2. Add the env vars from `server/.env.example` (set `NODE_ENV=production`, `CLIENT_URL=https://<app>.vercel.app`).
3. `server/vercel.json` routes everything to `api/index.js`. API URL: `https://<api>.vercel.app/api`.
   Note: Vercel limits request bodies to about 4.5 MB, so keep gallery uploads under that or use Render for large videos.

**Option C: Railway / Fly.io / Koyeb** - any Node host: root `server`, build `npm install`, start `npm start`, same env vars.

After deploying the API, run the seed once against production:
```bash
cd server && MONGO_URI="<prod uri>" ADMIN_EMAILS="owner@gmail.com" SEED_ADMIN_PASSWORD="strong-pass" npm run seed
```

### MongoDB Atlas
- Network Access -> allow `0.0.0.0/0` (hosts use dynamic IPs).
- The connection string goes in `MONGO_URI` (database name `saloonease` is in the URI).

### Cloudinary
Dashboard -> copy **Cloud name, API key, API secret** into `CLOUDINARY_*`. Uploads are organised under `<CLOUDINARY_FOLDER>/<section>`.
Use the account's **root API key** (Settings -> Access Keys). A restricted key without upload rights makes every upload fail with
"Cloudinary refused the upload: this API key has no upload permission".

### Email (forgot password + booking confirmation)
Gmail: enable 2-step verification -> create an **App Password** -> `SMTP_USER=you@gmail.com`, `SMTP_PASS=<app password>`.
Without SMTP the API logs the reset link to the console (and returns it in dev mode) so you can still test.

---

## 5. Environment variables

**server/.env**

| Key | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Auth token signing |
| `CLIENT_URL` | Allowed frontend origin(s), comma separated |
| `ADMIN_EMAILS` | Emails that get admin role automatically |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET/FOLDER` | Media uploads |
| `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM` | Emails |
| `SEED_ADMIN_*` | Used only by `npm run seed` |

**client/.env.local**

| Key | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base, ends with `/api` |
| `NEXT_PUBLIC_APP_NAME` | Fallback app name before settings load |

---

## 6. API overview (`/api`)

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password/:token`, `GET/PATCH /auth/me`, `POST /auth/change-password` |
| Public | `GET /settings`, `/services`, `/barbers`, `/dates`, `/slots?barberId&serviceId&date`, `/queue?barberId&date` |
| Client | `POST /bookings`, `GET /bookings/mine`, `GET /bookings/:id`, `PATCH /bookings/:id/cancel` |
| Admin | `/admin/stats`, `/admin/queue`, `/admin/bookings` (list/create/status/payment/reschedule), `/admin/barbers/:id/call-next`, `/admin/services`, `/admin/barbers`, `/admin/availability/*`, `/admin/settings`, `/admin/settings/gallery`, `/admin/payments`, `/admin/clients`, `/admin/upload` |

Queue logic: tokens are numbered per day (starting at `tokenStart`). A barber's queue is ordered by slot time then token.
Position and estimated start are computed live from the client in the chair plus the durations of everyone ahead.
Slots are generated from salon hours (overridable per barber and per day) in `slotInterval` steps and exclude booked, blocked and past times.
