import { Bus } from "lucide-react";
import { BRAND } from "@/lib/brand";

/** Brand mark + name. Long names (e.g. a person's name) are cut short with "…" rather than widening the page. */
export function Logo({ light = false, suffix, iconOnly = false }: { light?: boolean; suffix?: string; iconOnly?: boolean }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-ink shadow-sm">
        <Bus className="size-5" />
      </span>
      {!iconOnly && <span className="truncate">{BRAND.name}</span>}
      {suffix && !iconOnly && <span className={`shrink-0 text-sm font-semibold ${light ? "text-teal-200" : "text-slate-400"}`}>{suffix}</span>}
    </span>
  );
}
