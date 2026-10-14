"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleCheckBig, Clock, Copy, MessageCircle, MessageSquareHeart, Navigation, Pause, Pencil, Phone, Play, Radio, Send, Star, Trash2, X } from "lucide-react";
import { CopyButton } from "@/components/admin/CopyButton";
import { MapView } from "@/components/carpool/MapView";
import { rememberRide, RideForm, type RideFormValues } from "@/components/carpool/RideForm";
import { deviceId, useMyLocation } from "@/components/carpool/useMyLocation";
import { useIdVerify, verifyBy } from "@/components/carpool/IdVerify";
import { Stars } from "@/components/carpool/Stars";
import { GenderIcon } from "@/components/SeatMap";
import { displayPhone, formatDate, formatFare, formatTime, todayLocal } from "@/lib/format";
import type { ManageData } from "@/lib/rides";
import type { VerifyMode } from "@/lib/verify";
import { addDays, describeSchedule } from "@/lib/schedule";

const dayWord = (d: string) => (d === todayLocal() ? "Today" : d === addDays(todayLocal(), 1) ? "Tomorrow" : formatDate(d));

export function ManageView({ token, data, isNew, saved, verify = null }: { token: string; data: ManageData; isNew: boolean; saved: boolean; verify?: VerifyMode }) {
  const router = useRouter();
  const { ride, points, bookings, runs } = data;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const loc = useMyLocation();
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the page's own address, after hydration
  useEffect(() => setOrigin(window.location.origin), []);
  const manageUrl = `${origin}/r/manage/${token}`;
  const rideUrl = `${origin}/r/${ride.slug}`;
  const title = `${points[0].name} → ${points[points.length - 1].name}`;

  useEffect(() => {
    if (isNew || saved) rememberRide({ slug: ride.slug, token, title });
  }, [isNew, saved, ride.slug, token, title]);

  // Fresh bookings without reloading.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 30000);
    return () => clearInterval(t);
  }, [router]);

  const send = useCallback(
    (lat: number, lng: number) => {
      if (Date.now() - lastSent.current < 8000) return;
      lastSent.current = Date.now();
      fetch("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: `d${deviceId()}`, role: "driver", token, lat, lng }) })
        .then(async (r) => !r.ok && setShareError((await r.json().catch(() => ({}))).error ?? "Couldn't share location"))
        .catch(() => {});
    },
    [token],
  );

  const startSharing = async () => {
    setShareError(null);
    const here = loc.pos ?? (await loc.request());
    if (!here) return setShareError("Allow location in your browser to share it with your riders.");
    setSharing(true);
    lastSent.current = 0;
    send(here.lat, here.lng);
    watch.current = navigator.geolocation.watchPosition((p) => send(p.coords.latitude, p.coords.longitude), undefined, { enableHighAccuracy: true, maximumAge: 10000 });
  };
  const stopSharing = () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setSharing(false);
    fetch("/api/live", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: `d${deviceId()}` }) }).catch(() => {});
  };
  useEffect(() => () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
  }, []);

  async function setStatus(status: "active" | "paused" | "cancelled") {
    if (status === "cancelled" && !confirm("Cancel this ride for good? Riders who booked won't be told automatically: message them.")) return;
    setBusy(true);
    await fetch(`/api/rides/manage/${token}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    setBusy(false);
    router.refresh();
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Remove ${name}'s booking?`)) return;
    await fetch(`/api/rides/manage/${token}/booking/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const byDate = new Map<string, typeof bookings>();
  for (const b of bookings) byDate.set(b.date, [...(byDate.get(b.date) ?? []), b]);
  const seatsOn = (d: string) => (byDate.get(d) ?? []).reduce((n, b) => n + b.seats, 0);
  const shareText = `🚗 Carpool: ${title}\n🕒 ${formatTime(ride.departTime)} · ${describeSchedule({ kind: ride.schedule, date: ride.date, days: ride.days, until: ride.until })}\n${ride.fare !== null ? `💵 ${formatFare(ride.fare)} per seat\n` : ""}Book a seat 👉 ${rideUrl}`;

  const formValues: RideFormValues = {
    kind: ride.kind,
    driverName: ride.driverName,
    driverPhone: displayPhone(ride.driverPhone),
    driverGender: ride.driverGender,
    car: ride.car,
    plate: ride.plate ?? "",
    seats: ride.seats,
    fare: ride.fare === null ? "" : String(ride.fare),
    riders: ride.riders,
    departTime: ride.departTime,
    schedule: ride.schedule,
    date: ride.date,
    days: ride.days,
    until: ride.until ?? "",
    notes: ride.notes ?? "",
    points,
  };

  if (editing)
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1 text-sm font-semibold text-white">
          <X className="size-4" /> Close without saving
        </button>
        <RideForm initial={formValues} token={token} lockedRoute={bookings.length > 0} onSaved={() => setEditing(false)} verify={verify} />
      </div>
    );

  return (
    <div className="space-y-4">
      {isNew && (
        <section className="animate-rise overflow-hidden rounded-3xl bg-white shadow-lift">
          <div className="bg-hero flex items-center gap-3 px-5 py-4 text-white">
            <CircleCheckBig className="size-10 shrink-0 animate-pop text-emerald-300" />
            <div>
              <div className="text-lg font-extrabold">{ride.status === "pending" ? "Your ride is saved!" : "Your ride is live!"}</div>
              <div className="text-sm text-teal-50/90">
                {ride.status === "pending" ? "It goes live by itself once your ID is approved." : "Riders searching your route can book now."}
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <p className="font-semibold text-red-700">Save this page&apos;s link: it&apos;s the only way to manage your ride (there&apos;s no account).</p>
            <div className="flex flex-wrap gap-2">
              <a href={`https://wa.me/${ride.driverPhone}?text=${encodeURIComponent(`My Hamsafar ride (${title}). Manage it here: ${manageUrl}`)}`} target="_blank" rel="noreferrer" className="btn bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                <Send className="size-4" /> Send the link to my WhatsApp
              </a>
              <CopyButton text={manageUrl} label="Copy my link" />
            </div>
            <p className="text-xs text-slate-500">It&apos;s also remembered on this phone under &ldquo;Your rides&rdquo; on the home page.</p>
          </div>
        </section>
      )}
      {saved && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Changes saved.</p>}
      <IdCheckBanner data={data} />

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ride.status === "active" ? "bg-emerald-100 text-emerald-800" : ride.status === "paused" || ride.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}
          >
            {ride.status === "active" ? "● Live" : ride.status === "paused" ? "Paused" : ride.status === "pending" ? "Waiting for ID check" : "Cancelled"}
          </span>
          <span className="text-sm text-slate-500">
            {formatTime(ride.departTime)} · {describeSchedule({ kind: ride.schedule, date: ride.date, days: ride.days, until: ride.until })} · {ride.seats} seats
            {ride.fare !== null ? ` · ${formatFare(ride.fare)}` : ""}
          </span>
        </div>
        <MapView className="h-52" routes={[{ points }]} markers={loc.pos && sharing ? [{ ...loc.pos, kind: "driver", label: "You" }] : []} fitKey="route" />
        <div className="flex flex-wrap gap-2">
          {ride.status !== "cancelled" && (
            <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Edit ride
            </button>
          )}
          {ride.status === "active" && (
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => setStatus("paused")}>
              <Pause className="size-4" /> Pause
            </button>
          )}
          {ride.status === "paused" && (
            <button type="button" className="btn-primary" disabled={busy} onClick={() => setStatus("active")}>
              <Play className="size-4" /> Resume
            </button>
          )}
          {ride.status !== "cancelled" && (
            <button type="button" className="btn-danger" disabled={busy} onClick={() => setStatus("cancelled")}>
              <Trash2 className="size-4" /> Cancel ride
            </button>
          )}
        </div>
      </section>

      {ride.status === "active" && (
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-bold">
            <Navigation className="size-5 text-brand" /> Live location while driving
          </h2>
          <p className="text-sm text-slate-600">Your riders see your car on the map, and so does the live map on the home page. Keep this page open while you drive.</p>
          {sharing ? (
            <button type="button" className="btn-danger w-full" onClick={stopSharing}>
              <Radio className="size-4 animate-pulse" /> Sharing live, tap to stop
            </button>
          ) : (
            <button type="button" className="btn-primary w-full" onClick={startSharing}>
              <Navigation className="size-4" /> Start sharing my location
            </button>
          )}
          {shareError && <p className="text-sm text-red-600">{shareError}</p>}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-bold">Share your ride</h2>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-1.5 pl-3 text-sm ring-1 ring-slate-200/70">
          <span className="min-w-0 flex-1 truncate font-medium text-brand">{rideUrl.replace(/^https?:\/\//, "")}</span>
          <CopyButton text={rideUrl} label="Copy" className="btn-ghost !px-3 !py-1.5" />
        </div>
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="btn w-full bg-[#25D366] text-white hover:bg-[#1ebe5b]">
          <Send className="size-4" /> Share in a WhatsApp group
        </a>
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">Riders</h2>
        {runs.length === 0 && bookings.length === 0 && <p className="text-sm text-slate-500">No upcoming days.</p>}
        <div className="space-y-4">
          {[...new Set([...runs.slice(0, 7), ...byDate.keys()])].sort().map((d) => {
            const list = byDate.get(d) ?? [];
            return (
              <div key={d}>
                <div className="mb-1 flex items-baseline justify-between border-b border-slate-100 pb-1">
                  <span className="font-semibold">{dayWord(d)}</span>
                  <span className="text-sm text-slate-500">
                    {seatsOn(d)}/{ride.seats} seats booked
                  </span>
                </div>
                {list.length === 0 ? (
                  <p className="py-1.5 text-sm text-slate-400">Nobody yet</p>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {list.map((b) => (
                      <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                        <GenderIcon gender={b.gender} className={`size-4 shrink-0 ${b.gender === "female" ? "text-female" : "text-male"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">
                            {b.name}
                            {b.seats > 1 && <span className="font-normal text-slate-500"> · {b.seats} seats</span>}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {b.pickup} → {b.drop}
                          </div>
                        </div>
                        <a href={`tel:+${b.phone}`} className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600" aria-label={`Call ${b.name}`}>
                          <Phone className="size-4" />
                        </a>
                        <a
                          href={`https://wa.me/${b.phone}?text=${encodeURIComponent(`Assalam o Alaikum ${b.name.split(" ")[0]}, this is ${ride.driverName.split(" ")[0]}, your Hamsafar driver for ${dayWord(d).toLowerCase()} (${formatTime(ride.departTime)}).`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="grid size-9 place-items-center rounded-full border border-slate-200 text-[#128C7E]"
                          aria-label={`WhatsApp ${b.name}`}
                        >
                          <MessageCircle className="size-4" />
                        </a>
                        <button type="button" className="p-1.5 text-slate-400 hover:text-red-600" onClick={() => remove(b.id, b.name)} aria-label={`Remove ${b.name}`}>
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-bold">
          <Star className="size-5 text-amber-500" /> Your rating
        </h2>
        {data.rating ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={data.rating.avg} className="size-5" />
              <span className="text-xl font-extrabold">{data.rating.avg.toFixed(1)}</span>
              <span className="text-sm text-slate-500">
                from {data.rating.count} rider{data.rating.count === 1 ? "" : "s"} · shown on all your rides
              </span>
            </div>
            <ul className="divide-y divide-slate-100 text-sm">
              {data.reviews.map((r, i) => (
                <li key={i} className="py-2">
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Stars value={r.stars} className="size-3" /> {r.name} · {formatDate(r.date)}
                  </span>
                  {r.comment ? <span className="text-slate-700 [overflow-wrap:anywhere]">{r.comment}</span> : <span className="text-slate-400">No comment</span>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-600">No ratings yet. After each ride, your riders can rate you from 1 to 5 stars. A good rating brings you more riders.</p>
        )}
      </section>

      <Link
        href={`/feedback?role=driver&ride=${ride.slug}&from=/r/${ride.slug}`}
        className="card flex items-center gap-3 !p-4 transition hover:shadow-lift"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-lt text-brand">
          <MessageSquareHeart className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Help us improve Hamsafar</span>
          <span className="block text-sm text-slate-500">Ideas, problems, or a rider who caused trouble: tell the Hamsafar team.</span>
        </span>
      </Link>

      {!isNew && (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
          <Copy className="size-3.5" /> Bookmark this page: it&apos;s your private link to this ride.
        </p>
      )}
    </div>
  );
}

/** Where the driver's ID check stands: waiting (with the time it should be done by), or turned down. */
function IdCheckBanner({ data }: { data: ManageData }) {
  const router = useRouter();
  const idCheck = useIdVerify();
  const c = data.idCheck;
  if (!c || (c.status !== "pending" && c.status !== "rejected")) return null;
  if (c.status === "pending")
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Clock className="mt-0.5 size-5 shrink-0" />
        <p>
          <b>We&apos;re checking your ID</b>: done within 24 hours (by {verifyBy(c.submittedAt)}).{" "}
          {data.ride.status === "pending" ? "This ride goes live by itself as soon as you're approved." : ""}
        </p>
      </section>
    );
  return (
    <section className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p>
        <b>Your ID wasn&apos;t approved</b>: {c.rejectReason ?? "please send it again"}. Riders can&apos;t book this ride until it is.
      </p>
      <button
        type="button"
        className="btn-primary"
        onClick={async () => {
          const st = await idCheck.ensure("driver", { phone: data.ride.driverPhone, name: data.ride.driverName, gender: data.ride.driverGender });
          if (st) router.refresh();
        }}
      >
        Send my ID again
      </button>
      {idCheck.dialog}
    </section>
  );
}
