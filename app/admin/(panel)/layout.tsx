import type { Metadata } from "next";
import Link from "next/link";
import { Bus, LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Van admin" }, robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Trips" },
  { href: "/admin/vehicles", label: "Vehicles" },
  { href: "/admin/account", label: "Account" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
              <Bus className="size-4" />
            </span>
            <span className="hidden sm:inline">Van admin</span>
          </Link>
          <nav className="flex flex-1 gap-1 text-sm font-medium">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100" title={`Sign out ${admin.email}`}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
