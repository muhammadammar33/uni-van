"use client";

import { AutoRecover } from "@/components/AutoRecover";
import "./globals.css";

/** Even the root layout failing recovers by reloading once. */
export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <AutoRecover />
      </body>
    </html>
  );
}
