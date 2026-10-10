# Hamsafar

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
| `/` | Everyone | Home page: who it's for, a live seat-picking demo, public trips open for booking |
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
