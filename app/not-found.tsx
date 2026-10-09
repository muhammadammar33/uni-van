import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="bg-grid flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <Logo />
      <div className="text-7xl" aria-hidden>
        🚐💨
      </div>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">This van has already left</h1>
        <p className="mx-auto mt-2 max-w-sm text-slate-600">
          The link may be old or mistyped. Open the latest link from your WhatsApp group, or find an open trip on the home page.
        </p>
      </div>
      <Link href="/" className="btn-primary px-6 py-3">
        See open trips
      </Link>
    </main>
  );
}
