import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FeedbackForm } from "@/components/carpool/FeedbackForm";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Send feedback",
  description: "Ideas, problems or safety concerns: tell the Hamsafar team. We read every message.",
};

const pick = <T extends string>(v: unknown, options: readonly T[]): T | undefined => (options.includes(v as T) ? (v as T) : undefined);

export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const sp = await searchParams;
  const from = typeof sp.from === "string" && sp.from.startsWith("/") ? sp.from : "/";
  return (
    <div className="min-h-dvh pb-16">
      <header className="bg-hero px-4 pb-16 pt-4 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href="/" aria-label="Home">
            <Logo light />
          </Link>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Help us improve Hamsafar</h1>
          <p className="mt-1 text-teal-50/90">An idea, something that didn&apos;t work, or a safety concern: tell us. We read every message.</p>
        </div>
      </header>
      <main className="mx-auto -mt-10 max-w-2xl px-4">
        <Link href={from} className="mb-3 inline-flex items-center gap-1 text-sm text-white/90 hover:text-white">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <FeedbackForm
          initialKind={pick(sp.kind, ["idea", "problem", "safety", "praise"] as const)}
          initialRole={pick(sp.role, ["rider", "driver", "other"] as const)}
          ride={typeof sp.ride === "string" ? sp.ride : ""}
          from={from}
        />
      </main>
    </div>
  );
}
