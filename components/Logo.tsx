import { Bus } from "lucide-react";
import { BRAND } from "@/lib/brand";

export function Logo({ light = false, suffix }: { light?: boolean; suffix?: string }) {
  return (
    <span className={`flex items-center gap-2 text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-ink shadow-sm">
        <Bus className="size-5" />
      </span>
      {BRAND.name}
      {suffix && <span className={`text-sm font-semibold ${light ? "text-teal-200" : "text-slate-400"}`}>{suffix}</span>}
    </span>
  );
}
