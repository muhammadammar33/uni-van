import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RideForm } from "@/components/carpool/RideForm";
import { Logo } from "@/components/Logo";
import { verifyMode } from "@/lib/verify";

// Reads the WhatsApp verification setting at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Offer a ride", description: "Fill the empty seats in your car. No sign-up." };

export default async function OfferPage({ searchParams }: PageProps<"/offer">) {
  const kind = (await searchParams).kind === "intercity" ? "intercity" : "city";
  return (
    <div className="min-h-dvh pb-16">
      <header className="bg-hero px-4 pb-16 pt-4 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href="/" aria-label="Home">
            <Logo light />
          </Link>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Offer a ride</h1>
          <p className="mt-1 text-teal-50/90">Going somewhere with empty seats? Share them and split the fuel. Takes two minutes, no account.</p>
        </div>
      </header>
      <main className="mx-auto -mt-10 max-w-2xl px-4">
        <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-white/90 hover:text-white">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <RideForm verify={verifyMode()} kind={kind} />
      </main>
    </div>
  );
}
