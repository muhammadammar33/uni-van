import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/BookingFlow";
import { formatDateRange } from "@/lib/format";
import { orgInfo } from "@/lib/orgTypes";
import { publicTrip } from "@/lib/trips";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const trip = await publicTrip((await params).slug);
  if (!trip) return { title: "Trip not found" };
  const description = `${trip.org.name} · ${orgInfo(trip.org.type).direction[trip.direction]} · ${formatDateRange(trip.date, trip.endDate, true)}. Pick your stop and seat.`;
  return { title: trip.title, description, openGraph: { title: `🚐 ${trip.title}`, description } };
}

export default async function TripPage({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const trip = await publicTrip(slug);
  if (!trip) notFound();
  return <BookingFlow slug={slug} initial={trip} />;
}
