import { ImageResponse } from "next/og";
import { OgFrame, OgPill } from "@/components/og/OgFrame";
import { DIRECTION_LABEL, formatDate, formatFare, formatTime } from "@/lib/format";
import { fareRange } from "@/lib/layout";
import { publicTrip } from "@/lib/trips";

export const alt = "Book your seat";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** WhatsApp link preview for a trip: date, direction, first stops and fare. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const trip = await publicTrip((await params).slug);
  if (!trip) return new ImageResponse(<OgFrame eyebrow="Trip not found" title="Ask the admin for a new link" />, size);
  const fares = fareRange(trip.layout, trip.fare);
  const first = trip.stops[0];
  return new ImageResponse(
    (
      <OgFrame eyebrow={`${DIRECTION_LABEL[trip.direction]} · ${formatDate(trip.date, true)}`} title={trip.title}>
        <div style={{ display: "flex", gap: 16 }}>
          {first && <OgPill>{`${first.name.length > 22 ? `${first.name.slice(0, 21)}…` : first.name} · ${formatTime(first.time)}`}</OgPill>}
          {fares && <OgPill>{fares.min === fares.max ? formatFare(fares.min) : `from ${formatFare(fares.min)}`}</OgPill>}
        </div>
        <OgPill accent>Book your seat →</OgPill>
      </OgFrame>
    ),
    size,
  );
}
