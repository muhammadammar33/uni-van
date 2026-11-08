import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CircleCheckBig } from "lucide-react";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Delete your account", description: `How to delete your ${BRAND.name} account and what's removed.` };

/** Public page on deleting an account (app stores ask for a web address that explains it). */
export default async function DeleteAccountPage({ searchParams }: PageProps<"/delete-account">) {
  const done = (await searchParams).done !== undefined;
  return (
    <div className="min-h-dvh pb-16">
      <header className="bg-hero px-4 pb-16 pt-4 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href="/" aria-label="Home">
            <Logo light />
          </Link>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Delete your account</h1>
          <p className="mt-1 text-teal-50/90">You can delete your {BRAND.name} account and its data at any time.</p>
        </div>
      </header>
      <main className="mx-auto -mt-10 max-w-2xl px-4">
        <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-white/90 hover:text-white">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <article className="card space-y-6 text-slate-700">
          {done && (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-800" role="status">
              <CircleCheckBig className="size-5" /> Your account has been deleted.
            </p>
          )}
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-ink">How</h2>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Sign in on the website or in the app with the same Google account, and open <b>My account</b>.
              </li>
              <li>
                At the bottom, tap <b>Delete my account</b>, type DELETE and confirm.
              </li>
            </ol>
            <p>
              <Link href="/me" className="font-semibold text-brand hover:underline">
                Go to My account →
              </Link>
            </p>
            {BRAND.whatsapp && (
              <p>
                Can&apos;t sign in? Message us on{" "}
                <a href={`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent("Please delete my Hamsafar account.")}`} className="font-semibold text-brand hover:underline">
                  WhatsApp
                </a>{" "}
                from the number on your account, and we&apos;ll delete it for you.
              </p>
            )}
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-ink">What&apos;s deleted, straight away</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your account (name, email, picture and WhatsApp number)</li>
              <li>Rides you offered, with their bookings and live location</li>
              <li>Seats you booked</li>
              <li>Reviews you wrote, and reviews of you as a driver</li>
              <li>Your ID details and ID photos</li>
              <li>Your WhatsApp chats with the {BRAND.name} team</li>
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-ink">What may be kept</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Records an organisation keeps itself, such as a university&apos;s list of its students and van bookings. Ask that organisation.</li>
              <li>
                If your account was blocked for safety reasons, only your Google ID and number, so the block still applies. Nothing else.
              </li>
              <li>Anonymous visit counts, which never contain your details.</li>
            </ul>
          </section>
        </article>
      </main>
    </div>
  );
}
