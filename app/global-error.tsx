"use client";

import { AutoRecover } from "@/components/AutoRecover";
import "./globals.css";

/** Even the root layout failing recovers by reloading once. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body>
        <AutoRecover error={error} />
      </body>
    </html>
  );
}
