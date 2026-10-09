import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverView } from "@/components/DriverView";
import { driverTrip } from "@/lib/trips";

export const dynamic = "force-dynamic";

// Private link: keep it out of search engines and link previews.
export const metadata: Metadata = { title: "Driver", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function DriverPage({ params }: PageProps<"/d/[token]">) {
  const { token } = await params;
  const trip = await driverTrip(token);
  if (!trip) notFound();
  return <DriverView token={token} initial={trip} />;
}
