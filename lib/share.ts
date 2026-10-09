import { DIRECTION_LABEL, formatDate, formatFare, formatTime } from "@/lib/format";
import { fareRange, type Layout } from "@/lib/layout";

type ShareTrip = {
  title: string;
  date: string;
  direction: keyof typeof DIRECTION_LABEL;
  departTime: string | null;
  notes: string | null;
  fare: number | null;
  layout: Layout;
};

/** The WhatsApp group message for a trip: date, stops with times, fare, note and the booking link. */
export function tripShareMessage(trip: ShareTrip, stops: { name: string; time: string }[], url: string): string {
  const toHome = trip.direction === "to_home";
  const fares = fareRange(trip.layout, trip.fare);
  return [
    `🚐 *${trip.title}*`,
    `📅 ${formatDate(trip.date, true)} · ${DIRECTION_LABEL[trip.direction]}`,
    trip.departTime ? `🕒 ${toHome ? "Leaves university at" : "Departs at"} ${formatTime(trip.departTime)}` : null,
    "",
    `${toHome ? "Drop-off" : "Pickup"} points:`,
    ...stops.map((s) => `• ${s.name}: ${formatTime(s.time)}`),
    fares ? `\n💵 Fare: ${fares.min === fares.max ? formatFare(fares.min) : `${formatFare(fares.min)} to ${formatFare(fares.max)}`} per seat` : null,
    trip.notes ? `\n${trip.notes}` : null,
    "",
    `Book your seat 👉 ${url}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
