"use client";

import { AutoRecover } from "@/components/AutoRecover";

/** Any page that fails in the browser recovers by reloading (see AutoRecover). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AutoRecover reset={reset} error={error} />;
}
