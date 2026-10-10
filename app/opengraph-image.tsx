import { ImageResponse } from "next/og";
import { OgFrame, OgPill } from "@/components/og/OgFrame";

export const alt = "Book your van seat";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OgFrame eyebrow="Vans · Coasters · Buses · Tours" title="Pick your stop. Pick your seat. Done.">
        <div style={{ display: "flex", gap: 16 }}>
          <OgPill>One link in WhatsApp</OgPill>
          <OgPill>Safe seating</OgPill>
          <OgPill accent>No app needed</OgPill>
        </div>
      </OgFrame>
    ),
    size,
  );
}
