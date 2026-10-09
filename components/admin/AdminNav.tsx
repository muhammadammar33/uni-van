"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Armchair, Bus, UserCog } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Trips", icon: Bus, match: (p: string) => p === "/admin" || p.startsWith("/admin/trips") },
  { href: "/admin/vehicles", label: "Vehicles", icon: Armchair, match: (p: string) => p.startsWith("/admin/vehicles") },
  { href: "/admin/account", label: "Account", icon: UserCog, match: (p: string) => p.startsWith("/admin/account") },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-1 justify-center gap-1 text-sm font-semibold sm:justify-start">
      {NAV.map((n) => {
        const on = n.match(path);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 transition ${on ? "bg-brand-lt text-brand-dk" : "text-slate-500 hover:bg-slate-100 hover:text-ink"}`}
          >
            <n.icon className="size-4" />
            <span className="hidden sm:inline">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
