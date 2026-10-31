import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Onboarding } from "@/components/carpool/Onboarding";
import { Logo } from "@/components/Logo";
import { currentUser, publicAccount, setupNeeded } from "@/lib/account";
import { identityByPhone, statusOf } from "@/lib/identity";
import { safeNext } from "@/lib/userSession";
import { verifyMode } from "@/lib/verify";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up your account", robots: { index: false } };

/** Right after signing in: WhatsApp number and ID check, then on to where they were going. */
export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const next = safeNext((await searchParams).next);
  const u = await currentUser();
  if (!u) redirect(`/signin?next=${encodeURIComponent(`/welcome?next=${next}`)}`);
  if (!(await setupNeeded(u))) redirect(next);
  const status = u.phone ? statusOf(await identityByPhone(u.phone)) : null;
  return (
    <div className="min-h-dvh pb-16">
      <header className="bg-hero px-4 pb-16 pt-4 text-white">
        <div className="mx-auto max-w-xl">
          <Link href="/" aria-label="Home">
            <Logo light />
          </Link>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Welcome, {u.name.split(" ")[0]}!</h1>
          <p className="mt-1 text-teal-50/90">Two quick steps, once, so everyone on Hamsafar is a real, known person.</p>
        </div>
      </header>
      <main className="mx-auto -mt-10 max-w-xl px-4">
        <Onboarding account={publicAccount(u)!} verify={verifyMode()} status={status} next={next} driverFirst={next.startsWith("/offer")} />
      </main>
    </div>
  );
}
