import { ImageResponse } from "next/og";
import { OgFrame, OgPill } from "@/components/og/OgFrame";

export const alt = "Hamsafar carpool";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OgFrame eyebrow="Carpool · Wah Cantt to Rawat" title="Share the ride. Split the fuel.">
        <div style={{ display: "flex", gap: 16 }}>
          <OgPill>Islamabad · Rawalpindi</OgPill>
          <OgPill>Rated drivers</OgPill>
          <OgPill accent>No sign-up</OgPill>
        </div>
      </OgFrame>
    ),
    size,
  );
}
