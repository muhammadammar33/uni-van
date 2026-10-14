import Link from "next/link";
import { Check, Eye, EyeOff, RotateCcw, ShieldAlert, Star, Trash2 } from "lucide-react";
import { deleteFeedback, setFeedbackStatus, setReviewHidden } from "@/app/admin/feedbackActions";
import { requireSuper } from "@/lib/auth";
import { FEEDBACK_KINDS, FEEDBACK_ROLES, feedbackCounts, feedbackList, latestReviews } from "@/lib/feedback";
import { displayPhone } from "@/lib/format";

export const metadata = { title: "Feedback" };

const KIND_STYLE = {
  idea: "bg-blue-100 text-blue-800",
  problem: "bg-amber-100 text-amber-800",
  safety: "bg-red-100 text-red-800",
  praise: "bg-emerald-100 text-emerald-800",
} as const;

const when = (d: Date) =>
  d.toLocaleString("en-GB", { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Karachi", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Super admin: messages from riders and drivers, and driver reviews to moderate. */
export default async function FeedbackAdminPage({ searchParams }: PageProps<"/admin/feedback">) {
  await requireSuper();
  const sp = await searchParams;
  const tab = sp.tab === "reviews" ? "reviews" : "messages";
  const show = sp.show === "done" || sp.show === "all" ? sp.show : "new";
  const [counts, messages, reviews] = await Promise.all([feedbackCounts(), tab === "messages" ? feedbackList(show) : [], tab === "reviews" ? latestReviews() : []]);
  const tabCls = (on: boolean) => `rounded-xl px-3 py-1.5 text-sm font-semibold ${on ? "bg-white shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-ink"}`;
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Feedback</h1>
      <p className="mb-5 text-sm text-slate-500">What riders and drivers tell you through the site, and their reviews of drivers.</p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin/feedback" className={tabCls(tab === "messages")}>
          Messages {counts.new > 0 && <span className="ml-1 rounded-full bg-brand px-1.5 text-xs text-white">{counts.new} new</span>}
        </Link>
        <Link href="/admin/feedback?tab=reviews" className={tabCls(tab === "reviews")}>
          Driver reviews
        </Link>
        {tab === "messages" && (
          <span className="ml-auto flex gap-1 text-sm">
            {(["new", "done", "all"] as const).map((k) => (
              <Link key={k} href={`/admin/feedback?show=${k}`} className={`rounded-lg px-2.5 py-1 ${show === k ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}>
                {k === "new" ? `New (${counts.new})` : k === "done" ? `Handled (${counts.done})` : "All"}
              </Link>
            ))}
          </span>
        )}
      </div>

      {tab === "messages" ? (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={`card !p-4 ${m.kind === "safety" && m.status === "new" ? "border-l-4 border-l-red-500" : ""} ${m.status === "done" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-bold ${KIND_STYLE[m.kind]}`}>
                  {m.kind === "safety" && <ShieldAlert className="mr-1 inline size-3.5 align-[-2px]" />}
                  {FEEDBACK_KINDS[m.kind]}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{FEEDBACK_ROLES[m.role]}</span>
                <span className="text-slate-400">{when(m.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line [overflow-wrap:anywhere]">{m.message}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {m.name && <span>From: {m.name}</span>}
                {m.contact && <span className="font-semibold text-ink">Reply to: {m.contact}</span>}
                {m.rideSlug && (
                  <Link href={`/r/${m.rideSlug}`} target="_blank" className="font-semibold text-brand hover:underline">
                    About ride /r/{m.rideSlug}
                  </Link>
                )}
                {m.page && !m.rideSlug && <span>Sent from {m.page === "/" ? "the home page" : m.page}</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <form action={setFeedbackStatus}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="status" value={m.status === "done" ? "new" : "done"} />
                  <button className="btn-ghost !px-3 !py-1.5 text-sm">
                    {m.status === "done" ? (
                      <>
                        <RotateCcw className="size-4" /> Mark as new
                      </>
                    ) : (
                      <>
                        <Check className="size-4" /> Mark handled
                      </>
                    )}
                  </button>
                </form>
                <form action={deleteFeedback}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="btn-ghost !px-3 !py-1.5 text-sm !text-red-600" aria-label="Delete message">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            </li>
          ))}
          {messages.length === 0 && <li className="card text-center text-slate-500">{show === "new" ? "No new messages." : "Nothing here yet."}</li>}
        </ul>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          {reviews.map(({ review: r, slug, driverName }) => (
            <li key={r.id} className={`flex flex-wrap items-start gap-3 px-4 py-3 text-sm ${r.hidden ? "bg-slate-50 opacity-60" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex text-amber-500" aria-label={`${r.stars} stars`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className={`size-4 ${i < r.stars ? "fill-current" : "text-slate-200"}`} />
                    ))}
                  </span>
                  <span className="font-semibold">
                    {r.riderName} → {driverName ?? "driver"} ({displayPhone(r.driverPhone)})
                  </span>
                  {r.hidden && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold">Hidden</span>}
                </div>
                {r.comment && <p className="mt-1 text-slate-600 [overflow-wrap:anywhere]">{r.comment}</p>}
                <div className="mt-1 text-xs text-slate-400">
                  {when(r.updatedAt)} · rider {displayPhone(r.riderPhone)}
                  {slug && (
                    <>
                      {" · "}
                      <Link href={`/r/${slug}`} target="_blank" className="text-brand hover:underline">
                        ride
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <form action={setReviewHidden}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="hidden" value={r.hidden ? "0" : "1"} />
                <button className="btn-ghost !px-3 !py-1.5 text-sm">
                  {r.hidden ? (
                    <>
                      <Eye className="size-4" /> Show
                    </>
                  ) : (
                    <>
                      <EyeOff className="size-4" /> Hide
                    </>
                  )}
                </button>
              </form>
            </li>
          ))}
          {reviews.length === 0 && <li className="px-4 py-6 text-center text-slate-500">No reviews yet.</li>}
        </ul>
      )}
    </>
  );
}
