import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/BookingFlow";
import { DIRECTION_LABEL, formatDate } from "@/lib/format";
import { publicTrip } from "@/lib/trips";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const trip = await publicTrip((await params).slug);
  if (!trip) return { title: "Trip not found" };
  const description = `${DIRECTION_LABEL[trip.direction]} · ${formatDate(trip.date, true)}. Pick your stop and seat.`;
  return { title: trip.title, description, openGraph: { title: `🚐 ${trip.title}`, description } };
}

export default async function TripPage({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const trip = await publicTrip(slug);
  if (!trip) notFound();
  return <BookingFlow slug={slug} initial={trip} />;
}
