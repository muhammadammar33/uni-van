import { BadgeCheck, Star } from "lucide-react";
import type { DriverRating } from "@/lib/rides";

/** Five stars, filled up to `value` (rounded to the nearest half is not worth it: whole stars read clearer). */
export function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex text-amber-500" role="img" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`${className} ${i < full ? "fill-current" : "text-slate-300"}`} aria-hidden />
      ))}
    </span>
  );
}

/** "★ 4.8 (12)", or "New driver" before anyone has rated them. */
export function RatingBadge({ rating, className = "" }: { rating: DriverRating | null; className?: string }) {
  if (!rating) return <span className={`rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 ${className}`}>New driver</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold text-ink ${className}`} title={`${rating.avg} from ${rating.count} rating${rating.count === 1 ? "" : "s"}`}>
      <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
      {rating.avg.toFixed(1)}
      <span className="font-medium text-slate-400">({rating.count})</span>
    </span>
  );
}

/** The driver's CNIC and licence were checked by the Hamsafar team. */
export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700" title="CNIC and driving licence checked by Hamsafar">
      <BadgeCheck className="size-3.5" />
      {compact ? "Verified" : "ID verified"}
    </span>
  );
}
