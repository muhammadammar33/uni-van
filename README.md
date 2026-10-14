# Hamsafar

Live at **[hamsafar.website](https://hamsafar.website)**.

**Right now Hamsafar is a carpool site for the Wah Cantt – Islamabad – Rawalpindi – Rawat corridor.** Drivers offer the empty seats in their car without signing up; riders search by pickup and drop-off and book a seat. The organisations platform described further down (vans, universities, tours, companies) is still in the code and still works, but it's hidden from the home page for now.

## Carpool

### Drivers (no account)

1. **Offer a ride** (`/offer`): starting point, any stops on the way, final destination. Each comes from the list of about 75 common places from Wah Cantt to Rawat, or from "use my current location", or from a pin dropped on the map.
2. When: **one day**, **every day**, or **chosen days of the week** (e.g. Mon – Fri), with an optional end date and the leaving time.
3. Car, number plate, seats, fare per seat, who can ride (anyone / women only / men only), a note, and the driver's name, WhatsApp number and gender.
4. Publishing gives the driver a **private link** (`/r/manage/<token>`), which they can also send to their own WhatsApp. It shows who booked each day (call / WhatsApp / remove) and lets them edit, pause, resume or cancel the ride and share their live location while driving. The link is the only key: anyone who has it can manage the ride. This browser also remembers the rides it created ("Your rides" on the home page).

### Riders (no account)

1. Search (`/` or `/search`) with a pickup and a drop-off (from the list, current location, or a pin) and optionally a day.
2. A ride matches when its route passes within about **3 km** of both points, **in the right direction**. Each result shows where to get on and off and how far the pickup is.
3. The ride page (`/r/<slug>`) shows the route on a map and the driver's live position. Book with name, phone and gender. The booking shows the driver's number with one-tap WhatsApp (message already written) and call. A seat can be cancelled from the same browser or with phone + booking code.
4. Rules: no double booking (locked transaction), one booking per phone per day, women-only / men-only rides enforced, seats can't be cut below what's already booked, and the route is locked once riders have booked.

### Driver ratings

- An hour after a ride leaves, the rider's booking turns into **"How was your ride with …?"**: 1 to 5 stars and an optional comment. From another phone, "Travelled with …? Rate the ride" asks for the phone number and booking code.
- Only riders who really travelled can rate (the booking's phone + code, after the ride). One rating per rider per driver; rating again replaces it.
- Ratings belong to the driver's phone number, so they follow the driver across all their rides. Ride cards show "★ 4.8 (12)" (or "New driver"); the ride page shows the latest comments with the rider's first name only; the driver sees all of them on their private page.
- Super admins can hide an abusive or fake review (**Admin → Feedback → Driver reviews**); hidden reviews don't count.

### Feedback to the Hamsafar team

- `/feedback`: idea, problem, safety concern or praise, from a rider, driver or anyone, with an optional name and phone/email for a reply. Linked from the home page, every ride page ("Problem with this ride?"), the driver's page and after a rating. Safety reports show the emergency numbers (15 Police, 1122 Rescue) first.
- Messages arrive in **Admin → Feedback** (super admins): new unhandled safety reports first, each with who sent it, how to reply and the ride it's about; mark handled or delete.
- Spam protection: a hidden field bots fill in, and at most 5 messages per hour from one sender.

### Location and privacy

- The site asks once for location access, with an explanation. It's used to suggest the nearest places and to centre the map.
- The **live map** on the home page shows drivers who are sharing their location (exact position, first name, linked to their ride) and riders who chose "Show me on the live map". Riders are **blurred to about 300 m and nameless**, and nobody appears unless they tap the button. Positions disappear after 3 minutes without an update.
- A driver's phone number is shown only to riders who booked; riders' numbers are shown only to their driver.

### Carpool pages and API

| Path | Purpose |
| --- | --- |
| `/` | Search, "rides leaving soon", your rides, live map |
| `/search?from=&to=&date=` | Matching rides on a map |
| `/offer` | Offer a ride |
| `/r/<slug>` | Public ride page and booking (the link to share) |
| `/r/manage/<token>` | Driver's private page, with their rating |
| `/feedback` | Send feedback to the Hamsafar team |
| `/admin/rides` | Super admin: all carpool rides |
| `/admin/feedback` | Super admin: feedback messages and driver reviews |
| `GET/POST /api/rides`, `/api/rides/<slug>[/book\|/lookup\|/cancel\|/review]`, `/api/rides/manage/<token>`, `/api/live`, `POST /api/feedback` | JSON API used by the pages |

The places list is in `lib/places.ts`, route matching in `lib/geo.ts` and schedules in `lib/schedule.ts` (`npm test` covers them). The maps are OpenStreetMap tiles drawn with Leaflet, and place names for dropped pins come from Nominatim. Neither needs an API key.

## Organisations platform (hidden for now)

Its landing page is at `/business` (not linked or indexed). `/admin`, `/o/<org>`, `/t/<code>` and `/d/<secret>` all work as before.

Seat booking for every van, coaster and bus in Pakistan. An organisation shares one link in its WhatsApp group; passengers pick their stop, see the pickup time and choose a seat on a picture of the vehicle, with males and females seated apart.

## Who it's for

Every client is an **organisation** with its own admins, vehicles, trips and (when it has one) list of registered riders. The type of organisation decides the wording and the default booking rules:

| Type | Riders | Default rules |
| --- | --- | --- |
| 🚐 **Van & coaster operator** (private intercity vans) | Anyone with the link; different people every trip | Males and females apart, one seat per person |
| 🎓 **University, college or school** | **Registered students only**, from a list uploaded as Excel/CSV | Males and females apart; name and gender come from the list |
| 🏔️ **Tour operator** | Anyone; nothing kept after the trip | No male/female rule, a family books up to 6 seats together, multi-day dates and an itinerary |
| 🏢 **Company staff transport** | **Registered employees only** | Same as universities |

Every rule can be changed per trip (seating rule, seats per booking, registered-only).

## Roles

- **Super admin** (Hamsafar): sees every organisation with its activity, creates organisations and their first admin, opens any organisation's dashboard to help, switches an organisation off (its admins can't sign in and nobody can book) or deletes it, and manages other super admins.
- **Organisation admin**: runs their own organisation only: trips, vehicles, riders list, team.
- **Driver**: a private link per trip, no login.
- **Passengers**: no account; name and phone (or, for registered-only trips, phone + roll no. / employee ID).

## Pages

| Path | Who | Purpose |
| --- | --- | --- |
| `/business` | Everyone | Organisations landing page (hidden): who it's for, a live seat-picking demo, public trips |
| `/o/<org>` | Everyone | An organisation's page: contact details and its open trips / tours |
| `/t/<code>` | Passengers | Book a seat (the link shared in WhatsApp) |
| `/d/<secret>` | Driver | Passengers stop by stop, call / WhatsApp, mark boarded and paid |
| `/admin/orgs` | Super admin | All organisations, platform totals, create organisation, super admins |
| `/admin/orgs/<id>` | Super admin | Organisation details, admins, public page, open dashboard, switch off, delete |
| `/admin` | Admin | Trips by day with seats and fares |
| `/admin/trips/new`, `/admin/trips/<id>` | Admin | Create and run a trip: share links, seat map, passengers, booking rules |
| `/admin/riders` | Admin (universities, companies) | Registered students / employees: import Excel or CSV, add, edit, switch off, export |
| `/admin/vehicles` | Admin | Seating plans |
| `/admin/account` | Admin | Team (admins of the organisation) and password |

## Registered riders (universities, schools, companies)

1. **Riders → Import Excel / CSV**. The first row holds column names. Needed: **Name**, **Phone**, **Gender** (Male/Female or M/F). Optional: **Roll No** (or Employee ID), **Class** (or Department / Shift), **Stop**. Common variants ("Mobile No", "Sex", "Roll Number", "Programme"...) are recognised. **Download template** gives a ready file.
2. The preview shows how many rows are good and why any row is skipped (missing name, bad phone, unknown gender, same phone twice).
3. Import: new phones are added, known phones are updated, nobody is deleted. Riders can also be added, edited or switched off one by one.
4. On a trip marked **registered only**, a rider enters their phone (and roll no. / employee ID if their record has one); their name and gender come from the list, so nobody can book under a false gender.

## Seating rules

- **Males and females apart** (default for operators, universities, companies): seats can be female-only, male-only or open; opposite genders are never booked side by side (same row, no aisle between).
- **No restriction** (default for tours): anyone anywhere; one person can book several seats (1–10, per trip) under one name, phone and booking code.

Two people tapping the same seat at once: only the first gets it (bookings run in a locked database transaction).

## Deploy on Vercel

1. Import this repository in Vercel; add **Neon Postgres** under Storage (sets `DATABASE_URL`).
2. Environment variables (see `.env.example`): `AUTH_SECRET` (32+ random characters), `ADMIN_EMAIL` and `ADMIN_PASSWORD` (the first super admin), optional `SITE_URL`, `NEXT_PUBLIC_CONTACT_WHATSAPP`, `NEXT_PUBLIC_PLATFORM_NAME` (default "Hamsafar"), `NEXT_PUBLIC_TIMEZONE` (default Asia/Karachi).
3. Each deploy runs `scripts/db-setup.ts`: migrations, default vehicles, first super admin.

### Domain (hamsafar.website)

1. Vercel → the project → **Settings → Domains** → add `hamsafar.website` (and `www.hamsafar.website`, redirecting to it).
2. At the registrar (Hostinger → Domains → hamsafar.website → **DNS / Nameservers**), remove the parking `A` / `CNAME` records and add the records Vercel shows, usually `A  @  76.76.21.21` and `CNAME  www  cname.vercel-dns.com`.
3. Once Vercel shows **Valid Configuration**, set `SITE_URL=https://hamsafar.website` and redeploy. From then on, visits to the old `*.vercel.app` address are sent to hamsafar.website (`proxy.ts`), and link previews, `robots.txt` and `sitemap.xml` use the domain.

**Upgrading from the single-operator version:** the migration creates one organisation holding all existing trips, vehicles and bookings, and makes every existing admin a super admin. If `NEXT_PUBLIC_BRAND_NAME` was set, that becomes the organisation's name. Sign in, open the organisation under **Organisations**, and add its own admin under **Team**.

## Local development

```bash
npm install
cp .env.example .env.local   # DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:setup
npm run dev
```

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop / production build (runs db-setup) / serve |
| `npm test` | Seat rules, rider-list parsing and formatting tests |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:generate` | New migration after changing `lib/db/schema.ts` |

## Project layout

```
app/                  Pages: home, /o (organisation), /t (booking), /d (driver), /admin, /api
app/admin/actions.ts  All admin actions; every one is limited to the admin's organisation
lib/orgTypes.ts       Organisation types: wording and default rules
lib/layout.ts         Vehicle grid, seat numbering, gender + neighbour rules
lib/trips.ts          Loading trips, booking (locked transaction, groups, registered riders), lookup, cancel, driver
lib/riders.ts         Excel/CSV rider list parsing and validation
lib/auth.ts           Sessions, super admin vs organisation admin, current organisation
lib/db/schema.ts      organizations, admins, riders, vehicles, trips, stops, bookings
drizzle/              SQL migrations
```
