import Link from "next/link";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  ArrowRight,
  Armchair,
  Banknote,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  LayoutGrid,
  ListChecks,
  Lock,
  MapPin,
  MessageCircle,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { DemoBooking } from "@/components/home/DemoBooking";
import { PhoneFrame } from "@/components/home/PhoneFrame";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";
import { db, schema as s } from "@/lib/db";
import { DIRECTION_LABEL, formatDate, formatFare, formatTime, todayLocal } from "@/lib/format";
import { fareRange, seatList } from "@/lib/layout";
import { closedReason } from "@/lib/trips";

export const dynamic = "force-dynamic";

/** Trips students can still book, so someone who lost the WhatsApp link can find theirs. */
async function openTrips() {
  if (!db) return [];
  try {
    const rows = await db
      .select({ trip: s.trips, booked: sql<number>`count(${s.bookings.id})::int` })
      .from(s.trips)
      .leftJoin(s.bookings, eq(s.bookings.tripId, s.trips.id))
      .where(and(eq(s.trips.status, "open"), gte(s.trips.date, todayLocal())))
      .groupBy(s.trips.id)
      .orderBy(asc(s.trips.date), asc(s.trips.direction))
      .limit(12);
    const firstStops = rows.length
      ? await db
          .select()
          .from(s.stops)
          .where(inArray(s.stops.tripId, rows.map((r) => r.trip.id)))
          .orderBy(asc(s.stops.sortOrder), asc(s.stops.time))
      : [];
    return rows
      .filter((r) => !closedReason(r.trip))
      .slice(0, 6)
      .map(({ trip, booked }) => ({
        trip,
        booked,
        total: seatList(trip.layout).length,
        fares: fareRange(trip.layout, trip.fare),
        first: firstStops.find((st) => st.tripId === trip.id),
      }));
  } catch {
    return [];
  }
}

const contactHref = BRAND.whatsapp ? `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(`Hi! I'm interested in ${BRAND.name} for our van.`)}` : null;

export default async function Home() {
  const trips = await openTrips();
  return (
    <div className="bg-white">
      <Nav />
      <Hero />
      {trips.length > 0 && <OpenTrips trips={trips} />}
      <BeforeAfter />
      <HowItWorks />
      <Features />
      <Roles />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 sm:px-6">
        <Link href="/" aria-label={BRAND.name} className="min-w-0">
          <Logo light />
        </Link>
        <nav className="hidden flex-1 gap-6 text-sm font-medium text-teal-100 md:flex">
          <a href="#how" className="hover:text-white">
            How it works
          </a>
          <a href="#features" className="hover:text-white">
            Features
          </a>
          <a href="#roles" className="hover:text-white">
            Admins & drivers
          </a>
          <a href="#faq" className="hover:text-white">
            FAQ
          </a>
        </nav>
        <Link href="/admin" className="ml-auto shrink-0 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20 md:ml-0">
          Admin sign in
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-hero relative overflow-hidden pb-20 pt-28 text-white sm:pt-32">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-teal-50 ring-1 ring-white/20">
            <Sparkles className="size-4 text-accent" /> Made for university vans
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            No more <span className="text-accent">&ldquo;Sir, is there a seat?&rdquo;</span> messages.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-teal-50/90">
            Share one link in the WhatsApp group. Students pick their stop, see the pickup time, and choose a seat on a picture of the van, with
            separate seating for males and females. The van fills itself.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#demo" className="btn-accent px-6 py-3 text-base">
              Try it now <ArrowRight className="size-4" />
            </a>
            {contactHref ? (
              <a href={contactHref} target="_blank" rel="noreferrer" className="btn px-6 py-3 text-base text-white ring-1 ring-white/30 hover:bg-white/10">
                <MessageCircle className="size-4" /> Talk to us
              </a>
            ) : (
              <a href="#how" className="btn px-6 py-3 text-base text-white ring-1 ring-white/30 hover:bg-white/10">
                See how it works
              </a>
            )}
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-teal-50/90">
            {["No app to install", "Works on any phone", "Seats update live"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-accent" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div id="demo" className="relative mx-auto scroll-mt-24">
          <div className="absolute -inset-10 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative animate-float">
            <PhoneFrame>
              <DemoBooking />
            </PhoneFrame>
          </div>
          <p className="relative mt-5 text-center text-sm text-teal-100">
            👆 It works. Switch male/female and tap a seat.
          </p>
        </div>
      </div>
    </section>
  );
}

type OpenTrip = Awaited<ReturnType<typeof openTrips>>[number];

function OpenTrips({ trips }: { trips: OpenTrip[] }) {
  return (
    <section className="border-b border-slate-100 bg-mist py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Trips open for booking</h2>
            <p className="text-slate-600">Lost the link from the group? Find your trip here.</p>
          </div>
          <span className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map(({ trip, booked, total, fares, first }) => {
            const left = total - booked;
            return (
              <li key={trip.id}>
                <Link href={`/t/${trip.slug}`} className="card group flex h-full flex-col !p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide">
                    <span className={trip.direction === "to_uni" ? "text-brand" : "text-amber-700"}>{DIRECTION_LABEL[trip.direction]}</span>
                    <span className="text-slate-500">{formatDate(trip.date)}</span>
                  </div>
                  <div className="mt-2 text-lg font-bold leading-snug">{trip.title}</div>
                  {first && (
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                      <MapPin className="size-4 shrink-0 text-slate-400" /> {first.name} · {formatTime(first.time)}
                    </div>
                  )}
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand to-teal-400" style={{ width: `${Math.round((booked / Math.max(total, 1)) * 100)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className={left <= 3 ? "font-semibold text-amber-700" : "text-slate-600"}>{left === 0 ? "Full" : `${left} of ${total} seats left`}</span>
                    {fares && <span className="font-semibold">{fares.min === fares.max ? formatFare(fares.min) : `from ${formatFare(fares.min)}`}</span>}
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                    Book a seat <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Bubble({ who, children, me = false, time }: { who?: string; children: React.ReactNode; me?: boolean; time: string }) {
  return (
    <div className={`flex ${me ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-xl px-3 py-1.5 text-[13px] shadow-sm ${me ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"}`}>
        {who && <div className="text-[11px] font-semibold text-[#c2410c]">{who}</div>}
        <span className="text-slate-800">{children}</span>
        <span className="ml-2 align-bottom text-[10px] text-slate-400">{time}</span>
      </div>
    </div>
  );
}

function BeforeAfter() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">From 60 messages to one link</h2>
          <p className="mt-3 text-lg text-slate-600">The admin stops counting seats by hand. Students stop waiting for a reply.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-3xl border border-red-100 bg-red-50/40">
            <div className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-red-700">
              <X className="size-4" /> Before: the WhatsApp group
            </div>
            <div className="space-y-2 bg-[#efeae2] p-4 [background-image:radial-gradient(rgb(0_0_0/0.04)_1px,transparent_1px)] [background-size:14px_14px]">
              <Bubble me time="9:02 PM">
                Van tomorrow 7 AM. Who&apos;s going? Message me with your stop.
              </Bubble>
              <Bubble who="Ali" time="9:03 PM">
                Sir 1 seat from Saddar
              </Bubble>
              <Bubble who="Hina" time="9:03 PM">
                Me too sir, Faizabad. Is the front seat free?
              </Bubble>
              <Bubble who="Usman" time="9:05 PM">
                Sir mere liye bhi 🙏
              </Bubble>
              <Bubble who="Sana" time="9:11 PM">
                Sir what time at Chandni Chowk??
              </Bubble>
              <Bubble who="Ali" time="9:40 PM">
                Sir confirm? Haven&apos;t heard back
              </Bubble>
              <Bubble me time="10:15 PM">
                Sorry van is full. Who said Saddar first? 😩
              </Bubble>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-emerald-50/40">
            <div className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-emerald-700">
              <Check className="size-4" /> After: {BRAND.name}
            </div>
            <div className="flex h-[calc(100%-44px)] flex-col justify-between gap-4 bg-[#efeae2] p-4 [background-image:radial-gradient(rgb(0_0_0/0.04)_1px,transparent_1px)] [background-size:14px_14px]">
              <div className="flex justify-end">
                <div className="w-[85%] overflow-hidden rounded-xl rounded-tr-none bg-[#d9fdd3] shadow-sm">
                  <div className="bg-hero m-1 rounded-lg p-3 text-white">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">To University · Mon, 12 Oct</div>
                    <div className="font-bold">Morning van</div>
                    <div className="mt-2 inline-flex rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-ink">Book your seat →</div>
                  </div>
                  <div className="px-3 pb-1.5 pt-1 text-[13px] text-slate-800">
                    🚐 <b>Morning van</b>
                    <br />• Saddar Chowk: 7:10 AM
                    <br />• Faizabad: 7:25 AM
                    <br />💵 Fare: Rs. 300 per seat
                    <br />
                    <span className="text-sky-700 underline">book your seat 👉 link</span>
                    <span className="ml-2 align-bottom text-[10px] text-slate-400">9:02 PM</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["15/15", "seats booked"],
                  ["0", "replies needed"],
                  ["9:14 PM", "van full"],
                ].map(([n, l]) => (
                  <div key={l} className="rounded-xl bg-white/90 p-3 shadow-sm">
                    <div className="text-xl font-extrabold text-brand">{n}</div>
                    <div className="text-[11px] text-slate-500">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: CalendarDays, title: "Create the trip", text: "Pick the date, direction and van. Add the stops with pickup times and the fare. Takes a minute, and tomorrow's trip is one tap: copy it." },
    { icon: Share2, title: "Share one link", text: "Tap Share on WhatsApp. The group gets a neat message with the stops, times, fare and a booking link with a rich preview." },
    { icon: Armchair, title: "Students book", text: "They choose male or female, their stop, and a seat on the van picture. They get a seat number and a booking code. Done." },
  ];
  return (
    <section id="how" className="bg-grid scroll-mt-10 border-y border-slate-100 bg-mist py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-brand">How it works</span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Three steps. Zero spreadsheets.</h2>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((st, i) => (
            <li key={st.title} className="card relative !p-6">
              <span className="absolute -top-4 left-6 grid size-8 place-items-center rounded-full bg-accent text-sm font-extrabold text-ink shadow">{i + 1}</span>
              <st.icon className="size-8 text-brand" />
              <h3 className="mt-4 text-lg font-bold">{st.title}</h3>
              <p className="mt-2 text-slate-600">{st.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: ShieldCheck, title: "Respectful seating", text: "Seats can be female-only, male-only or open. Males and females are never booked side by side, automatically." },
    { icon: LayoutGrid, title: "Any vehicle", text: "Draw your Hiace, Coaster or bus seat by seat: seats, aisle, door and driver. Save it once, reuse it every trip." },
    { icon: MapPin, title: "Stops & pickup times", text: "Students choose their stop and see exactly when to be there. Drop-off points and times for the trip home." },
    { icon: Banknote, title: "Fares", text: "One fare per seat, or charge more for the front seats. Students see the price before they book." },
    { icon: Zap, title: "No double booking", text: "Two students tapping the same seat at once? Only the first gets it. The seat map refreshes live." },
    { icon: Smartphone, title: "No app, no login", text: "A link that opens on any phone. Name and phone number, that's it. Remembered for next time." },
    { icon: RefreshCw, title: "Repeat in one tap", text: "Copy a trip to tomorrow, or turn the morning trip into the return trip with the stops reversed." },
    { icon: Lock, title: "Private by design", text: "Students only see which seats are taken. Names and numbers stay with the admin and the driver." },
  ];
  return (
    <section id="features" className="scroll-mt-10 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-brand">Features</span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Everything a van needs. Nothing it doesn&apos;t.</h2>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <li key={f.title} className="group rounded-2xl border border-slate-200/80 p-5 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-lt text-brand transition group-hover:bg-brand group-hover:text-white">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{f.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Roles() {
  const roles = [
    {
      icon: ListChecks,
      who: "For the admin",
      points: ["Live seat map with every passenger's name", "Book a seat for someone who called you", "Passenger list by stop, copied in one tap", "Fares expected vs collected"],
    },
    {
      icon: Users,
      who: "For students",
      points: ["Book in under 10 seconds", "Know your seat and pickup time up front", "Cancel or check your booking any time", "Same link works for everyone"],
    },
    {
      icon: UserCheck,
      who: "For the driver",
      points: ["Private link, no login", "Passengers stop by stop, in route order", "Call or WhatsApp anyone running late", "Tick boarded & paid as you go"],
    },
  ];
  return (
    <section id="roles" className="scroll-mt-10 bg-ink py-20 text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_auto]">
        <div>
          <span className="text-sm font-bold uppercase tracking-wider text-accent">One system, three happy people</span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Built for everyone in the van</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {roles.map((r) => (
              <div key={r.who}>
                <r.icon className="size-7 text-accent" />
                <h3 className="mt-3 font-bold">{r.who}</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {r.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-teal-400" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mx-auto">
          <PhoneFrame dark>
            <DriverPreview />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}

/** Static picture of the driver's screen. */
function DriverPreview() {
  const people = [
    { seat: 1, name: "Hina Shah", g: "female" as const, boarded: true, paid: true },
    { seat: 4, name: "Sana Iqbal", g: "female" as const, boarded: true, paid: false },
    { seat: 9, name: "Ali Raza", g: "male" as const, boarded: false, paid: false },
  ];
  return (
    <div className="bg-mist pb-4 text-ink">
      <div className="bg-slate-900 px-4 pb-3 pt-3 text-white">
        <div className="text-[11px] font-semibold text-teal-300">Driver · To University</div>
        <div className="font-bold">Morning van</div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-white text-center">
        {[
          ["3", "Passengers"],
          ["2/3", "Boarded"],
          ["300/900", "Collected"],
        ].map(([v, l]) => (
          <div key={l} className="py-2">
            <div className="text-sm font-bold">{v}</div>
            <div className="text-[9px] uppercase text-slate-500">{l}</div>
          </div>
        ))}
      </div>
      <div className="m-3 rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
          <span className="grid size-5 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">1</span>
          <div className="text-sm font-semibold">Saddar Chowk</div>
          <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
            <Clock className="size-3" /> 7:10 AM
          </span>
        </div>
        {people.map((p) => (
          <div key={p.seat} className="border-b border-slate-100 px-3 py-2 last:border-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="grid size-6 place-items-center rounded-md bg-slate-100 text-xs font-bold">{p.seat}</span>
              <span className={p.g === "female" ? "text-female" : "text-male"}>{p.g === "female" ? "♀" : "♂"}</span>
              <span className="font-medium">{p.name}</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(["boarded", "paid"] as const).map((k) => (
                <span
                  key={k}
                  className={`rounded-md py-1 text-center text-[11px] font-semibold ${p[k] ? "bg-emerald-600 text-white" : "border border-slate-200 text-slate-500"}`}
                >
                  {p[k] ? "✓ " : ""}
                  {k === "boarded" ? "Boarded" : "Paid Rs. 300"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Faq() {
  const faqs = [
    ["Do students need to install an app or make an account?", "No. They open the link from the WhatsApp group in any phone browser and enter their name and phone number. Their details are remembered for next time."],
    ["How does the male/female seating work?", "The admin marks each seat as female-only, male-only or open to anyone. On top of that, the system never lets a male and a female sit side by side. Across the aisle is fine."],
    ["Can it handle our vehicle?", "Yes. A Toyota Hiace and a Coaster are ready to use, and the admin can draw any layout (seats, aisle, door, driver) on a simple grid and save it."],
    ["What if two students choose the same seat at the same time?", "Only the first booking goes through. The second student is told right away and picks another seat. The seat map also refreshes every few seconds."],
    ["Can a student change or cancel?", "Yes. The booking page remembers their booking, and they can cancel with one tap until booking closes. On another phone they use their phone number and booking code."],
    ["What about the trip back home?", "One tap turns the morning trip into the return trip: direction flipped, stops reversed. Set the drop-off times and share the new link."],
    ["Does the driver see phone numbers?", "Only through the driver's private link, which the admin sends to the driver alone. Students never see each other's names or numbers."],
  ];
  return (
    <section id="faq" className="scroll-mt-10 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-brand">FAQ</span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Questions, answered</h2>
        </div>
        <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {faqs.map(([q, a]) => (
            <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {q}
                <ChevronDown className="size-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-20 sm:px-6">
      <div className="bg-hero relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-14 text-center text-white sm:px-12">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
        <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Fill your van tonight, not at 10 PM.</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-lg text-teal-50/90">Set up the first trip in a couple of minutes and share it with your group.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          {contactHref && (
            <a href={contactHref} target="_blank" rel="noreferrer" className="btn-accent px-6 py-3 text-base">
              <MessageCircle className="size-4" /> Get it for your van
            </a>
          )}
          <Link href="/admin" className={contactHref ? "btn px-6 py-3 text-base text-white ring-1 ring-white/30 hover:bg-white/10" : "btn-accent px-6 py-3 text-base"}>
            Admin sign in <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-100 py-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:px-6">
        <Logo />
        <span>{BRAND.tagline}</span>
      </div>
    </footer>
  );
}
