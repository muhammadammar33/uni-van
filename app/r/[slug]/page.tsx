import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { RideView } from "@/components/carpool/RideView";
import { Logo } from "@/components/Logo";
import { formatFare, formatTime } from "@/lib/format";
import { publicRide } from "@/lib/rides";
import { describeSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/r/[slug]">): Promise<Metadata> {
  const ride = await publicRide((await params).slug);
  if (!ride) return { title: "Ride not found" };
  const from = ride.points[0].name;
  const to = ride.points[ride.points.length - 1].name;
  const description = `${formatTime(ride.departTime)} · ${describeSchedule(ride.schedule)}${ride.fare !== null ? ` · ${formatFare(ride.fare)} per seat` : ""}. Book a seat on Hamsafar.`;
  return { title: `${from} → ${to}`, description, openGraph: { title: `🚗 ${from} → ${to}`, description } };
}

export default async function RidePage({ params, searchParams }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const ride = await publicRide(slug);
  if (!ride) notFound();
  const sp = await searchParams;
  const num = (k: string) => (typeof sp[k] === "string" && /^\d+$/.test(sp[k] as string) ? Number(sp[k]) : undefined);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;
  const from = ride.points[0].name;
  const to = ride.points[ride.points.length - 1].name;
  return (
    <div className="min-h-dvh">
      <header className="bg-hero px-4 pb-16 pt-4 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Home">
              <Logo light />
            </Link>
            <Link href="/search" className="ml-auto rounded-xl bg-white/10 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/20">
              Other rides
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <span>{from}</span>
            <ArrowRight className="size-6 text-accent" />
            <span>{to}</span>
          </div>
          <p className="mt-1 text-teal-50/90">
            {formatTime(ride.departTime)} · {describeSchedule(ride.schedule)}
            {ride.fare !== null ? ` · ${formatFare(ride.fare)} per seat` : " · Free"}
          </p>
        </div>
      </header>
      <RideView slug={slug} initial={ride} start={{ date, p: num("p"), d: num("d") }} />
    </div>
  );
}
