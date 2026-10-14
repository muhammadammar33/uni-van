"use client";

import { ShieldCheck } from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";
import type { RideBookingView } from "@/lib/rides";

/**
 * "Share my trip": sends family the driver, car, number plate, trip and a link where they can follow the car
 * live (when the driver shares their location).
 */
export function ShareTrip({ booking, slug, verified }: { booking: RideBookingView; slug: string; verified: boolean }) {
  async function share() {
    const link = `${window.location.origin}/r/${slug}`;
    const text = [
      "🚗 I'm travelling with Hamsafar",
      `Driver: ${booking.driverName}${verified ? " (ID verified)" : ""}`,
      `Car: ${booking.car}${booking.plate ? ` · ${booking.plate}` : ""}`,
      `Trip: ${booking.pickup} → ${booking.drop}, ${formatDate(booking.date)} at ${formatTime(booking.departTime)}`,
      `Follow the car live: ${link}`,
    ].join("\n");
    if (navigator.share) await navigator.share({ text }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }
  return (
    <button type="button" onClick={share} className="btn mt-2 w-full border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">
      <ShieldCheck className="size-4" /> Share my trip with family
    </button>
  );
}
