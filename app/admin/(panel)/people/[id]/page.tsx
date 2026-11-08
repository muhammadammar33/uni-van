import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, IdCard, MessageCircle } from "lucide-react";
import { blockAction, deleteAccountAction, unblockAction } from "@/app/admin/peopleActions";
import { SubmitConfirm } from "@/components/admin/SubmitConfirm";
import { requireSuper } from "@/lib/auth";
import { displayPhone, formatDate, formatTime } from "@/lib/format";
import { personDetail } from "@/lib/people";

export const metadata = { title: "Person" };
export const dynamic = "force-dynamic";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Karachi";
const when = (d: Date) => d.toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const REASONS = ["Unsafe or threatening behaviour", "Harassment or abuse", "Fake or someone else's ID", "Fake rides or bookings", "Repeated no-shows or cancellations", "Asked for money or favours", "Other"];

/** Super admin: one person, their rides and bookings, and Block / Unblock. */
export default async function PersonPage({ params, searchParams }: PageProps<"/admin/people/[id]">) {
  await requireSuper();
  const id = Number((await params).id);
  const d = Number.isInteger(id) ? await personDetail(id) : null;
  if (!d) notFound();
  const { user: u, rides, bookings, identity } = d;
  const sp = await searchParams;
  return (
    <>
      <Link href="/admin/people" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> People
      </Link>
      {typeof sp.blocked === "string" && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">Blocked. {sp.blocked === "0" ? "They had no live rides." : sp.blocked === "1" ? "Their live ride was paused." : `${sp.blocked} of their rides were paused.`}</p>}
      {sp.unblocked && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Unblocked. Their paused rides stay paused until they resume them.</p>}
      {typeof sp.error === "string" && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>}

      <div className="mt-3 flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-2xl font-bold text-slate-500">
          {u.picture ? (
            // eslint-disable-next-line @next/next/no-img-element -- Google profile picture
            <img src={u.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            u.name.slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold">{u.name}</h1>
          <p className="truncate text-sm text-slate-500">{u.email}</p>
          <p className="text-sm text-slate-500">
            {u.phone ? displayPhone(u.phone) : "No number yet"} · joined {formatDate(u.createdAt.toISOString().slice(0, 10))}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {identity && (
          <Link href={`/admin/verifications/${identity.id}`} className="btn-ghost">
            <IdCard className="size-4" /> ID check
          </Link>
        )}
        {u.phone && (
          <Link href={`/admin/whatsapp/${u.phone}`} className="btn-ghost">
            <MessageCircle className="size-4" /> WhatsApp chat
          </Link>
        )}
      </div>

      <section className={`card mt-4 space-y-3 ${u.blockedAt ? "ring-2 ring-red-200" : ""}`}>
        {u.blockedAt ? (
          <>
            <h2 className="flex items-center gap-2 font-bold text-red-700">
              <Ban className="size-5" /> Blocked
            </h2>
            <p className="text-sm text-slate-700">
              {when(u.blockedAt)}
              {d.blockedByName && ` by ${d.blockedByName}`}: {u.blockReason}
            </p>
            <form action={unblockAction}>
              <input type="hidden" name="id" value={u.id} />
              <button className="btn-ghost">Unblock</button>
            </form>
          </>
        ) : (
          <>
            <h2 className="font-bold">Block this person</h2>
            <p className="text-sm text-slate-600">
              They&apos;re signed out and can&apos;t sign in again, and their rides are paused so nobody books them. Their number and CNIC stay on record, so they can&apos;t come
              back with another Google account using them. You can unblock them later.
            </p>
            <form action={blockAction} className="space-y-2">
              <input type="hidden" name="id" value={u.id} />
              <select name="reason" className="input" aria-label="Reason" defaultValue={REASONS[0]}>
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <input name="other" className="input" placeholder="Details (needed for Other)" maxLength={300} aria-label="Details" />
              <SubmitConfirm message={`Block ${u.name}? They'll be signed out and their rides paused.`} className="btn w-full bg-red-600 py-3 text-white hover:bg-red-700">
                <Ban className="size-4" /> Block {u.name.split(" ")[0]}
              </SubmitConfirm>
            </form>
          </>
        )}
      </section>

      <section className="card mt-4 space-y-2">
        <h2 className="font-bold">Delete this account</h2>
        <p className="text-sm text-slate-600">
          Only when they ask (for example on WhatsApp). Removes their account, rides, bookings, reviews, ID and WhatsApp chats, as on the public{" "}
          <Link href="/delete-account" className="font-semibold text-brand">
            delete-account page
          </Link>
          .{u.blockedAt ? " As they're blocked, their Google ID and number are kept so the block still holds." : ""}
        </p>
        <form action={deleteAccountAction}>
          <input type="hidden" name="id" value={u.id} />
          <SubmitConfirm message={`Delete ${u.name}'s account and all their data? This can't be undone.`} className="btn-ghost !text-red-700">
            Delete account
          </SubmitConfirm>
        </form>
      </section>

      <h2 className="mt-6 font-bold">Rides they offer ({rides.length})</h2>
      <ul className="card mt-2 divide-y divide-slate-100 !p-0 text-sm">
        {rides.length === 0 && <li className="p-4 text-slate-500">None.</li>}
        {rides.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2.5">
            <Link href={`/r/${r.slug}`} className="font-semibold text-brand">
              {formatTime(r.departTime)} · {r.kind}
            </Link>
            <span className="text-slate-500">
              {r.schedule} from {formatDate(r.date)} · {r.status}
            </span>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 font-bold">Bookings ({bookings.length})</h2>
      <ul className="card mt-2 divide-y divide-slate-100 !p-0 text-sm">
        {bookings.length === 0 && <li className="p-4 text-slate-500">None.</li>}
        {bookings.map(({ booking: b, ride }) => (
          <li key={b.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2.5">
            <span className="font-semibold">{formatDate(b.date)}</span>
            <span className="text-slate-500">
              with {ride.driverName} ({displayPhone(ride.driverPhone)}) · {b.seats} seat{b.seats > 1 ? "s" : ""}
              {b.boardedAt && " · boarded"}
              {b.noShowAt && " · didn't come"}
            </span>
            <Link href={`/r/${ride.slug}`} className="text-brand">
              ride
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
