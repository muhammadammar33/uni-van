"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Armchair, Building2, Bus, UserCog, Users } from "lucide-react";

const ICONS = { trips: Bus, vehicles: Armchair, riders: Users, team: UserCog, orgs: Building2 };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const isOn = (href: string, path: string) =>
  href === "/admin" ? path === "/admin" || path.startsWith("/admin/trips") : path === href || path.startsWith(href + "/");

export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex min-w-0 flex-1 justify-center gap-1 overflow-x-auto text-sm font-semibold sm:justify-start">
      {items.map((n) => {
        const on = isOn(n.href, path);
        const Icon = ICONS[n.icon];
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            title={n.label}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 transition ${on ? "bg-brand-lt text-brand-dk" : "text-slate-500 hover:bg-slate-100 hover:text-ink"}`}
          >
            <Icon className="size-4" />
            <span className="hidden md:inline">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
