"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheckBig, ShieldAlert, Star } from "lucide-react";
import { Stars } from "@/components/carpool/Stars";
import { formatDate } from "@/lib/format";
import type { RideBookingView, RiderReview } from "@/lib/rides";

const WORDS = ["", "Bad", "Not good", "Okay", "Good", "Excellent"];

/** After the ride: the rider rates the driver (stars + optional comment). */
export function RateDriver({ slug, booking, review, onSaved }: { slug: string; booking: RideBookingView; review: RiderReview | null; onSaved: (r: RiderReview) => void }) {
  const first = booking.driverName.trim().split(/\s+/)[0];
  const [editing, setEditing] = useState(!review);
  const [stars, setStars] = useState(review?.stars ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!stars) return setError("Tap the stars to rate.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rides/${slug}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: booking.phone, code: booking.code, stars, comment }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't send your rating. Please try again.");
      onSaved(json.review);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing && review)
    return (
      <section className="card animate-rise">
        <div className="flex items-start gap-3">
          <CircleCheckBig className="size-8 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">Thanks for rating {first}!</h2>
            <div className="mt-1 flex items-center gap-2">
              <Stars value={review.stars} />
              <span className="text-sm font-semibold text-slate-600">{WORDS[review.stars]}</span>
            </div>
            {review.comment && <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">&ldquo;{review.comment}&rdquo;</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <button type="button" className="font-semibold text-brand hover:underline" onClick={() => setEditing(true)}>
                Change my rating
              </button>
              <Link href={`/feedback?kind=safety&role=rider&ride=${slug}&from=/r/${slug}`} className="flex items-center gap-1 font-semibold text-red-700 hover:underline">
                <ShieldAlert className="size-4" /> Report a problem
              </Link>
            </div>
          </div>
        </div>
      </section>
    );

  const shown = hover || stars;
  return (
    <form onSubmit={send} className="card animate-rise space-y-3 border-2 border-amber-200">
      <div>
        <h2 className="text-lg font-bold">How was your ride with {first}?</h2>
        <p className="text-sm text-slate-500">
          {formatDate(booking.date)} · {booking.pickup} → {booking.drop}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setStars(n)}
              onMouseEnter={() => setHover(n)}
              className="p-1 transition active:scale-90"
            >
              <Star className={`size-9 ${n <= shown ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
            </button>
          ))}
        </div>
        <span className="text-sm font-bold text-slate-600">{WORDS[shown]}</span>
      </div>
      <div>
        <label className="label" htmlFor="review-comment">
          Anything to add? <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          className="input min-h-20"
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="On time? Safe driving? Clean car?"
        />
      </div>
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      <button className="btn-primary w-full py-3" disabled={busy || !stars}>
        {busy ? "Sending…" : review ? "Update my rating" : "Send my rating"}
      </button>
      <p className="text-center text-xs text-slate-500">
        Shown on {first}&apos;s rides with your first name only. Something serious?{" "}
        <Link href={`/feedback?kind=safety&role=rider&ride=${slug}&from=/r/${slug}`} className="font-semibold text-red-700 hover:underline">
          Report it to the Hamsafar team
        </Link>
        .
      </p>
    </form>
  );
}
