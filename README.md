# Uni Van

Seat booking for a university van. Instead of messaging the admin in the WhatsApp group, students open the trip link, choose their stop and a seat, and they're booked.

- **Admin** creates a trip (to university, or back home), adds the stops with pickup / drop-off times, and shares the link in the WhatsApp group with one tap.
- **Students** open the link, choose Female or Male, choose their stop (they see its time), and tap a seat on a picture of the van. No account needed: name and phone number.
- **Seating rules:** the admin marks each seat **Female**, **Male** or **Anyone**. On top of that, the app never lets a male and a female sit **side by side**: once someone takes a seat, the seats directly next to it (same row, no aisle in between) are only open to the same gender. Seats across the aisle are fine.
- **Fares:** set a fare per seat on each trip (e.g. Rs. 300), and optionally a different price on single seats (e.g. Rs. 400 for the front). Students see the price before booking and on their ticket; the price is locked in when they book.
- **Driver view:** a private link for the driver, no login: passengers stop by stop in route order, with call / WhatsApp buttons and **Boarded** and **Paid** ticks, plus totals collected.
- **Any vehicle:** the seating is a grid the admin draws: seats, aisle, door, driver. A Toyota Hiace (15 seats) and a Coaster (29 seats) are included to start from.

## Pages

| Path | Who | Purpose |
| --- | --- | --- |
| `/` | Everyone | Home page: what the service does, a live seat-picking demo, and the trips open for booking (for students who lost the link) |
| `/t/<code>` | Students | Book a seat on a trip (the link shared in WhatsApp) |
| `/d/<secret>` | Driver | Passengers by stop, call / WhatsApp, mark boarded and paid (link from the trip page) |
| `/admin` | Admin | Upcoming and past trips, with seats booked |
| `/admin/trips/new` | Admin | New trip: direction, date, vehicle, fare per seat, stops and times, note, booking deadline |
| `/admin/trips/<id>` | Admin | Share link + WhatsApp message, driver link, fares expected / collected, seat map with passenger names, book a seat for someone, passengers by stop (copy as a list for the driver), close/reopen booking, copy the trip to another date or as the return trip |
| `/admin/trips/<id>/seats` | Admin | Change this trip's seating and single-seat prices (booked seats are locked) |
| `/admin/vehicles` | Admin | Saved seating plans for new trips |
| `/admin/account` | Admin | Add admins/drivers, change password |

### How students book

1. Choose **Female** or **Male**. Seats they can't take are greyed out with a lock.
2. Choose the **pickup point** (trips to university) or **drop-off point** (trips home), which shows its time.
3. Tap a seat.
4. Enter name and phone, then **Book seat**.

They get a seat number and a 4-letter **booking code**. The page remembers it on their phone, so opening the link again shows their booking with a **Cancel** button. On another phone they use **Already booked? Find my booking** with their phone number and code. A phone number can hold one seat per trip.

The seat map refreshes every 10 seconds. If two people go for the same seat at once, only the first gets it (bookings are checked inside a locked database transaction).

Booking closes when the admin closes it, at the optional **Stop booking at** time, or after the trip date.

### Daily routine for the admin

1. Create the morning trip once with all the stops.
2. On its page use **Copy this trip** for the next day, or tick **Make it the return trip** for the trip home: direction flipped, stops reversed, then set the drop-off times.
3. Tap **Share on WhatsApp** and send it to the group.
4. Send the driver the **Driver link** from the trip page (**Send to driver**). On the road the driver ticks who boarded and who paid; you see the same ticks and the amount collected on the trip page. **New link** makes the old driver link stop working (e.g. a different driver today).

### Fares

- **Fare per seat** on the trip form applies to every seat.
- For a seat that costs more or less, open **Seating**, choose the **Seat price** tool, type the price and tap the seats. Leave the price empty and tap to go back to the trip fare. Seat prices can also be saved on a vehicle so every new trip gets them.
- Each booking keeps the price it was booked at, so changing the fare later doesn't change what booked students were told.

### WhatsApp link previews

Every trip link shows a branded preview card in WhatsApp with the direction, date, first stop and fare (`app/t/[slug]/opengraph-image.tsx`); the home page has its own (`app/opengraph-image.tsx`). Set `SITE_URL` so WhatsApp can fetch them.

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS, PostgreSQL with Drizzle ORM. Same setup as a free Vercel + Neon deployment.

## Deploy on Vercel

1. Import this repository in Vercel.
2. Project → Storage → add **Neon Postgres** and connect it (this sets `DATABASE_URL`).
3. Project → Settings → Environment Variables (see `.env.example`):
   - `AUTH_SECRET`: a random string of 32+ characters (`openssl rand -base64 48`)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`: the first admin login
   - optional `SITE_URL` (e.g. `https://van.example.com`) for share links and WhatsApp previews, and `NEXT_PUBLIC_TIMEZONE` (default `Asia/Karachi`)
   - optional branding: `NEXT_PUBLIC_BRAND_NAME` (default "Uni Van"), `NEXT_PUBLIC_BRAND_TAGLINE`, and `NEXT_PUBLIC_CONTACT_WHATSAPP` (adds "Talk to us" buttons on the home page)
4. Redeploy. The build runs `scripts/db-setup.ts`, which creates the tables, adds the Hiace and Coaster vehicles, and creates the first admin.
5. Sign in at `/admin`.

## Local development

Requires Node.js 20+ and any PostgreSQL database.

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:setup             # tables + default vehicles + first admin
npm run dev
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Database setup + production build |
| `npm test` | Seat rule and formatting tests |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:generate` | New migration after changing `lib/db/schema.ts` |

## Project layout

```
app/t/[slug]/        Student booking page
app/api/t/[slug]/    Seat map, book, look up and cancel (JSON)
app/d/[token]/       Driver view; app/api/d/[token]/ its data and boarded/paid ticks
app/admin/           Login, trips, seating editor, vehicles, account; actions.ts holds the server actions
components/          SeatMap (shared), BookingFlow (student), DriverView, home/ (landing page demo), admin/ (trip form, layout editor, trip tools)
lib/brand.ts         Product name, tagline and contact number (from env)
lib/share.ts         The WhatsApp group message for a trip
lib/layout.ts        Vehicle grid, seat numbering, neighbour + gender rules (tested in layout.test.ts)
lib/trips.ts         Loading trips, booking (locked transaction), lookup, cancel, driver view + boarded/paid
lib/db/schema.ts     Tables: admins, vehicles, trips, stops, bookings
drizzle/             SQL migrations
scripts/db-setup.ts  Migrate, default vehicles, first admin
```

Privacy: the public trip page only shows which seats are taken and by which gender. Names and phone numbers are visible to admins and to whoever has the trip's driver link, so send that link to the driver only.
