import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy", description: `What ${BRAND.name} keeps about you, why, and who can see it.` };

const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-lg font-bold">{title}</h2>
    <div className="space-y-2 text-slate-700">{children}</div>
  </section>
);

/** Plain-language privacy notice, linked from the ID check. */
export default function PrivacyPage() {
  return (
    <div className="min-h-dvh pb-16">
      <header className="bg-hero px-4 pb-16 pt-4 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href="/" aria-label="Home">
            <Logo light />
          </Link>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Your privacy</h1>
          <p className="mt-1 text-teal-50/90">What we keep, why, and who can see it.</p>
        </div>
      </header>
      <main className="mx-auto -mt-10 max-w-2xl px-4">
        <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-white/90 hover:text-white">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <article className="card space-y-6">
          <S title="Why we check IDs">
            <p>
              Hamsafar puts strangers in the same car. To keep that safe, every driver and rider is a real, known person: drivers show their CNIC, driving licence and car,
              and riders their CNIC (or, under 18, their B-form and a parent&apos;s CNIC). If something goes wrong on a ride, we can tell the authorities who was there.
            </p>
          </S>
          <S title="What we keep">
            <ul className="list-disc space-y-1 pl-5">
              <li>Your phone number (your account), name and gender.</li>
              <li>Your ID details (CNIC or B-form number, date of birth, expiry; a parent&apos;s name and CNIC for under-18s) and photos of the card and a selfie.</li>
              <li>For drivers: driving licence number, expiry and photo, and the car&apos;s registration number.</li>
              <li>Your rides, bookings and ratings. Your location only while you choose to share it (riders are shown blurred and without a name).</li>
            </ul>
          </S>
          <S title="Who can see it">
            <p>
              <b>Only the Hamsafar team.</b> Drivers never see riders&apos; IDs and riders never see drivers&apos;. Riders only see a driver&apos;s first name, car, rating and an
              &ldquo;ID verified&rdquo; badge; the driver&apos;s phone number is shown only after booking, and a rider&apos;s number only to their own driver.
            </p>
            <p>ID photos are stored encrypted. Each time a team member opens one, it is recorded.</p>
            <p>We share information with the police or other authorities only when the law requires it, for example after an incident on a ride.</p>
          </S>
          <S title="How long we keep it">
            <p>While you use Hamsafar. You can ask us to delete your ID details and photos at any time through the feedback page; your past rides and bookings are kept for safety records.</p>
          </S>
          <S title="Questions">
            <p>
              Write to us on the{" "}
              <Link href="/feedback?from=/privacy" className="font-semibold text-brand underline">
                feedback page
              </Link>
              .
            </p>
          </S>
        </article>
      </main>
    </div>
  );
}
