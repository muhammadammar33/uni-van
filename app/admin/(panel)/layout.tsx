import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/Logo";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:gap-6">
          <Link href="/admin" aria-label="Trips" className="min-w-0 shrink">
            <span className="hidden max-w-64 sm:block">
              <Logo suffix="Admin" />
            </span>
            <span className="sm:hidden">
              <Logo iconOnly />
            </span>
          </Link>
          <AdminNav />
          <form action={logout} className="flex shrink-0 items-center gap-3">
            <span className="hidden text-right text-xs leading-tight md:block">
              <span className="block font-semibold text-ink">{admin.name}</span>
              <span className="text-slate-400">{admin.email}</span>
            </span>
            <button className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-ink" title="Sign out" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
