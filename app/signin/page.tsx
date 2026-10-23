import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { GoogleButton } from "@/components/GoogleButton";
import { Logo } from "@/components/Logo";
import { authEnabled, currentUser } from "@/lib/account";
import { safeNext } from "@/lib/userSession";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/** Sign in with Google (the only way in for riders and drivers). */
export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (!authEnabled() || (await currentUser())) redirect(next);
  const error = typeof sp.error === "string" ? sp.error.slice(0, 200) : null;
  return (
    <div className="flex min-h-dvh flex-col bg-hero px-4 py-6 text-white">
      <Link href="/" aria-label="Home" className="mx-auto w-full max-w-md">
        <Logo light />
      </Link>
      <main className="mx-auto my-auto w-full max-w-md py-10">
        <div className="card space-y-5 text-center text-ink">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Sign in to Hamsafar</h1>
            <p className="mt-1 text-slate-600">To offer rides and book seats. Your rides and bookings stay with you on any phone.</p>
          </div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <GoogleButton next={next} className="w-full" />
          <p className="flex items-start gap-2 text-left text-xs text-slate-500">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
            We only get your name, email and profile picture from Google, never your password. By continuing you agree to the{" "}
            <Link href="/terms" className="underline">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              privacy
            </Link>
            .
          </p>
        </div>
        <Link href={next} className="mt-4 block text-center text-sm text-white/80 hover:text-white">
          Not now
        </Link>
      </main>
    </div>
  );
}
