import { BRAND } from "@/lib/brand";
import { MARK_PIN } from "@/lib/logoMark";

/** The Hamsafar mark (see lib/logoMark.ts), as a rounded tile. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  // Same gradient for every copy on a page, so a fixed id is fine (and works in server components).
  const id = "hm-logo-grad";
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 drop-shadow-sm ${className}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset=".55" stopColor="#0f766e" />
          <stop offset="1" stopColor="#134e4a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <path d={MARK_PIN} fill="#fff" />
      <circle cx="25.5" cy="21.5" r="4.2" fill="#0f766e" />
      <path d="M18.3 34.5a7.2 7.2 0 0 1 14.4 0z" fill="#0f766e" />
      <circle cx="38.5" cy="21.5" r="4.2" fill="#f59e0b" stroke="#fff" strokeWidth="1.4" paintOrder="stroke" />
      <path d="M31.3 34.5a7.2 7.2 0 0 1 14.4 0z" fill="#f59e0b" stroke="#fff" strokeWidth="1.4" paintOrder="stroke" />
    </svg>
  );
}

/** Mark + wordmark. "Ham" (together) and "safar" (journey) in two colours when the name is Hamsafar. */
export function Logo({ light = false, suffix, iconOnly = false }: { light?: boolean; suffix?: string; iconOnly?: boolean }) {
  const split = BRAND.name === "Hamsafar";
  return (
    <span className={`flex min-w-0 items-center gap-2 text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>
      <LogoMark />
      {!iconOnly && (
        <span className="truncate">
          {split ? (
            <>
              Ham<span className={light ? "text-amber-300" : "text-brand"}>safar</span>
            </>
          ) : (
            BRAND.name
          )}
        </span>
      )}
      {suffix && !iconOnly && <span className={`shrink-0 text-sm font-semibold ${light ? "text-teal-200" : "text-slate-400"}`}>{suffix}</span>}
    </span>
  );
}
