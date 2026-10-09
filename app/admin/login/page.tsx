import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const next = (await searchParams).next;
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="bg-hero relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
        <Link href="/" className="relative w-fit">
          <Logo light />
        </Link>
        <div className="relative">
          <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">Tonight&apos;s van, filled before you finish your tea.</h2>
          <ul className="mt-8 space-y-3 text-teal-50/90">
            {["Create a trip and share it in one tap", "Watch seats fill live, safely by gender", "Hand the driver a ready passenger list"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-accent text-ink">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-teal-100/70">Admin area</p>
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink">
            <ArrowLeft className="size-4" /> Home
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="mb-8 mt-1 text-slate-600">Sign in to manage trips, seats and drivers.</p>
          <LoginForm next={typeof next === "string" ? next : ""} />
        </div>
      </main>
    </div>
  );
}
