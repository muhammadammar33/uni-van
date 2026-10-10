import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { ArrowLeftRight, LogOut } from "lucide-react";
import { AdminNav, type NavItem } from "@/components/admin/AdminNav";
import { Logo } from "@/components/Logo";
import { ORG_COOKIE, requireAdmin } from "@/lib/auth";
import { db, schema as s } from "@/lib/db";
import { orgInfo } from "@/lib/orgTypes";
import { leaveOrg, logout } from "../actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const orgId = admin.role === "super" ? Number((await cookies()).get(ORG_COOKIE)?.value) || null : admin.orgId;
  const [org] = orgId && db ? await db.select().from(s.organizations).where(eq(s.organizations.id, orgId)).limit(1) : [];

  const items: NavItem[] = [];
  if (org) {
    items.push({ href: "/admin", label: "Trips", icon: "trips" }, { href: "/admin/vehicles", label: "Vehicles", icon: "vehicles" });
    if (orgInfo(org.type).roster) items.push({ href: "/admin/riders", label: orgInfo(org.type).riders.replace(/^./, (c) => c.toUpperCase()), icon: "riders" });
    items.push({ href: "/admin/account", label: "Team", icon: "team" });
  }
  if (admin.role === "super") items.push({ href: "/admin/orgs", label: "Organisations", icon: "orgs" });

  return (
    <div className="min-h-dvh">
      {admin.role === "super" && (
        <div className="bg-ink text-xs text-slate-300">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1.5">
            <span className="rounded bg-accent px-1.5 py-0.5 font-bold text-ink">SUPER ADMIN</span>
            {org ? (
              <>
                <span className="min-w-0 truncate">
                  Working in <b className="text-white">{org.name}</b>
                </span>
                <form action={leaveOrg} className="ml-auto shrink-0">
                  <button className="flex items-center gap-1 font-semibold text-white hover:text-accent">
                    <ArrowLeftRight className="size-3.5" /> All organisations
                  </button>
                </form>
              </>
            ) : (
              <span>Platform overview</span>
            )}
          </div>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:gap-6">
          <Link href={org ? "/admin" : "/admin/orgs"} aria-label="Home" className="flex min-w-0 shrink items-center gap-2">
            <Logo iconOnly />
            <span className="hidden min-w-0 leading-tight sm:block">
              <span className="block max-w-56 truncate font-extrabold">{org?.name ?? "Hamsafar"}</span>
              <span className="block text-xs font-semibold text-slate-400">{org ? orgInfo(org.type).label : "Super admin"}</span>
            </span>
          </Link>
          <AdminNav items={items} />
          <form action={logout} className="flex shrink-0 items-center gap-3">
            <span className="hidden text-right text-xs leading-tight lg:block">
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
