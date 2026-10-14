import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ManageView } from "@/components/carpool/ManageView";
import { Logo } from "@/components/Logo";
import { manageRide } from "@/lib/rides";
import { verifyMode } from "@/lib/verify";

export const dynamic = "force-dynamic";
// Private link: keep it out of search engines and away from referrers.
export const metadata: Metadata = { title: "Manage your ride", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ManagePage({ params, searchParams }: PageProps<"/r/manage/[token]">) {
  const { token } = await params;
  const data = await manageRide(token);
  if (!data) notFound();
  const sp = await searchParams;
  const pts = data.points;
  return (
    <div className="min-h-dvh pb-16">
      <header className="bg-hero px-4 pb-16 pt-4 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href="/" aria-label="Home">
            <Logo light />
          </Link>
          <p className="mt-6 text-sm font-bold uppercase tracking-wider text-accent">Your ride · private page</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {pts[0].name} → {pts[pts.length - 1].name}
          </h1>
        </div>
      </header>
      <main className="mx-auto -mt-10 max-w-2xl px-4">
        <ManageView token={token} data={data} isNew={sp.new !== undefined} saved={sp.saved !== undefined} verify={verifyMode()} />
      </main>
    </div>
  );
}
