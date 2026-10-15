import Link from "next/link";
import { ArrowRight, Car, Check, MapPinned, MessageCircle, MessageSquareHeart, Route, ShieldCheck, Star, Users } from "lucide-react";
import { LiveMap } from "@/components/carpool/LiveMap";
import { LocationPrompt } from "@/components/carpool/LocationPrompt";
import { MyRides } from "@/components/carpool/MyRides";
import { RideCard } from "@/components/carpool/RideCard";
import { SearchBox } from "@/components/carpool/SearchBox";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { searchRides, type SearchResult } from "@/lib/rides";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `${BRAND.name}: carpool in Islamabad, Rawalpindi & across Pakistan`,
  description: "Find a seat in a car going your way across Islamabad and Rawalpindi, or between cities all over Pakistan. Or offer the empty seats in yours.",
};

async function soon(): Promise<SearchResult[]> {
  if (!db) return [];
  try {
    const [city, intercity] = await Promise.all([searchRides(null, null, null, "city"), searchRides(null, null, null, "intercity")]);
    return [...city, ...intercity]
      .sort((a, b) => a.runs[0].date.localeCompare(b.runs[0].date) || a.departTime.localeCompare(b.departTime))
      .slice(0, 6);
  } catch {
    return [];
  }
}

export default async function Home() {
  const rides = await soon();
  return (
    <div className="bg-white">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="min-w-0">
            <Logo light />
          </Link>
          <Link href="/offer" className="ml-auto shrink-0 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20">
            Offer a ride
          </Link>
        </div>
      </header>

      <section className="bg-hero relative overflow-hidden pb-16 pt-24 text-white sm:pt-28">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_28rem]">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-teal-50 ring-1 ring-white/20">
              <Route className="size-4 text-accent" /> Wah Cantt · Taxila · Islamabad · Rawalpindi · Rawat
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Share the ride.
              <br />
              <span className="text-accent">Split the fuel.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-teal-50/90">
              Find a seat in a car already going your way, or fill the empty seats in yours. Daily commutes across the twin cities, or a trip to Lahore, Peshawar or anywhere in Pakistan.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-teal-50/90">
              {["ID-verified drivers & riders", "City & intercity rides", "Women-only rides", "Live driver location"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-accent" /> {t}
                </li>
              ))}
            </ul>
            <Link href="/offer" className="btn-accent mt-8 hidden px-6 py-3 text-base lg:inline-flex">
              <Car className="size-5" /> I&apos;m driving: offer my seats
            </Link>
          </div>
          <div className="animate-rise [animation-delay:100ms]">
            <SearchBox />
            <Link href="/offer" className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-teal-50 hover:text-white lg:hidden">
              <Car className="size-4" /> Driving? Offer your empty seats <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-14 sm:px-6">
        <MyRides />

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Rides leaving soon</h2>
              <p className="text-slate-600">Search above for rides on your exact route.</p>
            </div>
            <Link href="/search" className="text-sm font-semibold text-brand hover:underline">
              See all rides →
            </Link>
          </div>
          {rides.length ? (
            <ul className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
              {rides.map((r) => (
                <li key={r.slug}>
                  <RideCard ride={r} href={`/r/${r.slug}`} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="card text-center text-slate-600">
              No rides offered yet. Driving somewhere?{" "}
              <Link href="/offer" className="font-semibold text-brand hover:underline">
                Offer the first one
              </Link>
              .
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <MapPinned className="size-6 text-brand" /> Live map
          </h2>
          <p className="mb-4 text-slate-600">Drivers on their way right now, and riders waiting for a ride. Everyone chooses whether to appear.</p>
          <LiveMap />
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="card">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <Users className="size-5 text-brand" /> Riding
            </h3>
            <ol className="mt-3 space-y-2 text-slate-600">
              <li>1. Choose your pickup and drop-off (from the list, your location, or a pin on the map).</li>
              <li>2. See every car passing near both, in the right direction.</li>
              <li>3. Book your seat: you get the driver&apos;s WhatsApp and can watch the car arrive.</li>
              <li>4. After the ride, rate your driver so others know who to ride with.</li>
            </ol>
          </div>
          <div className="card">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <Car className="size-5 text-brand" /> Driving
            </h3>
            <ol className="mt-3 space-y-2 text-slate-600">
              <li>1. Add your start, stops on the way and destination, and when you go: once, daily or chosen days.</li>
              <li>2. Get your private link: see who booked, call or WhatsApp them, pause any day.</li>
              <li>3. Share your live location while driving so riders know when to step out.</li>
            </ol>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [ShieldCheck, "Women-only rides", "Drivers can take only women (or only men). Riders' phone numbers are shown only to their driver."],
            [Star, "Verified, rated drivers", "Every driver's CNIC, licence and car are checked, and riders rate them after each ride."],
            [MessageCircle, "WhatsApp, not calls", "Once booked, message the driver in one tap with your booking already written."],
            [MapPinned, "Any point on the way", "Not on the list? Drop a pin. Rides within about 3 km of your pickup and drop-off show up."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <div key={t as string} className="rounded-2xl border border-slate-200/80 p-5">
                <I className="size-6 text-brand" />
                <h3 className="mt-3 font-bold">{t as string}</h3>
                <p className="mt-1 text-sm text-slate-600">{d as string}</p>
              </div>
            );
          })}
        </section>
        <section className="flex flex-col items-start gap-4 rounded-3xl bg-brand-lt/60 p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-brand shadow-sm">
            <MessageSquareHeart className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold tracking-tight">Help us make {BRAND.name} better</h2>
            <p className="text-slate-600">Riding or driving, tell us what to improve, what went wrong, or a place missing from the list. We read every message.</p>
          </div>
          <Link href="/feedback?from=/" className="btn-primary shrink-0">
            Send feedback
          </Link>
        </section>
      </div>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:px-6">
          <Logo />
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Carpooling in the twin cities and across Pakistan · {BRAND.domain}</span>
            <Link href="/feedback?from=/" className="font-semibold text-brand hover:underline">
              Feedback
            </Link>
            <Link href="/terms" className="font-semibold text-brand hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="font-semibold text-brand hover:underline">
              Privacy
            </Link>
          </span>
        </div>
      </footer>
      <LocationPrompt />
    </div>
  );
}
