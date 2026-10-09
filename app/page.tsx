import Link from "next/link";
import { Bus } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand text-white">
        <Bus className="size-7" />
      </span>
      <h1 className="text-2xl font-bold">Uni Van</h1>
      <p className="text-slate-600">Open the trip link shared in your WhatsApp group to book your seat.</p>
      <Link href="/admin" className="text-sm font-medium text-brand hover:underline">
        Admin sign in
      </Link>
    </main>
  );
}
