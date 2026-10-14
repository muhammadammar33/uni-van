import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, ExternalLink, Eye, Trash2, X } from "lucide-react";
import { approveId, deleteId, rejectId } from "@/app/admin/verificationActions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { requireSuper } from "@/lib/auth";
import { displayPhone, formatDate, formatTime } from "@/lib/format";
import { identityDetail } from "@/lib/identity";
import { ageOn, formatIdNumber, LICENSE_AUTHORITIES, VEHICLE_CHECKS, type LicenseAuthority } from "@/lib/identityRules";
import { todayLocal } from "@/lib/format";

export const metadata = { title: "Check ID", referrer: "no-referrer" };

const DOC_LABEL: Record<string, string> = {
  selfie: "Selfie",
  cnic_front: "CNIC front",
  cnic_back: "CNIC back",
  license: "Driving licence",
  bform: "B-form",
  guardian_front: "Parent's CNIC front",
  guardian_back: "Parent's CNIC back",
};
const ORDER = ["selfie", "cnic_front", "cnic_back", "bform", "guardian_front", "guardian_back", "license"];
const REASONS = ["The photos aren't clear: please take them again in good light", "The selfie doesn't match the CNIC photo", "The details don't match the card", "The CNIC or licence has expired", "The licence couldn't be verified"];

const when = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Super admin: one person's ID, to approve or turn down, with their ride history. */
export default async function VerificationDetail({ params, searchParams }: PageProps<"/admin/verifications/[id]">) {
  await requireSuper();
  const d = await identityDetail(Number((await params).id));
  if (!d) notFound();
  const sp = await searchParams;
  const { identity: i, docs, rides, bookings, views } = d;
  const docs2 = [...docs].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const auth = i.licenseAuthority ? LICENSE_AUTHORITIES[i.licenseAuthority as LicenseAuthority] : null;
  const waiting = i.riderStatus === "pending" || i.driverStatus === "pending";
  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5 text-sm last:border-0">
        <dt className="text-slate-500">{label}</dt>
        <dd className="text-right font-semibold [overflow-wrap:anywhere]">{value}</dd>
      </div>
    ) : null;
  return (
    <>
      <Link href="/admin/verifications" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Verifications
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight">{i.fullName}</h1>
      <p className="mb-4 text-sm text-slate-500">
        Sent {when(i.submittedAt)} · {displayPhone(i.phone)} · Rider: <b>{i.riderStatus}</b>
        {i.driverStatus !== "none" && (
          <>
            {" "}
            · Driver: <b>{i.driverStatus}</b>
          </>
        )}
      </p>
      {sp.approved !== undefined && (
        <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          Approved.{Number(sp.approved) > 0 ? ` ${sp.approved} waiting ride${sp.approved === "1" ? " is" : "s are"} now live.` : ""}
        </p>
      )}
      {sp.rejected && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">Turned down. They&apos;ll see the reason and can send their ID again.</p>}
      {i.warnings.length > 0 && (
        <ul className="mb-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {i.warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] [&>*]:min-w-0">
        <section className="card !p-3">
          <h2 className="mb-2 px-1 font-bold">Photos</h2>
          <div className="grid grid-cols-2 gap-2">
            {docs2.map((doc) => (
              <a key={doc.id} href={`/api/admin/id-docs/${doc.id}`} target="_blank" className="group block overflow-hidden rounded-xl border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, uncached image */}
                <img src={`/api/admin/id-docs/${doc.id}`} alt={DOC_LABEL[doc.kind]} className="aspect-[4/3] w-full bg-slate-100 object-contain" />
                <span className="block px-2 py-1 text-xs font-semibold text-slate-600 group-hover:text-brand">{DOC_LABEL[doc.kind]} ↗</span>
              </a>
            ))}
          </div>
          <p className="mt-2 px-1 text-xs text-slate-500">Compare the selfie with the CNIC photo. Each time a photo is opened, it&apos;s logged.</p>
        </section>

        <div className="space-y-4">
          <section className="card !p-4">
            <h2 className="mb-1 font-bold">Details</h2>
            <dl>
              {row(i.idType === "cnic" ? "CNIC" : "B-form", formatIdNumber(i.idNumber))}
              {row("Name", i.fullName)}
              {row("Father / husband", i.fatherName)}
              {row("Gender", i.gender)}
              {row("Date of birth", `${formatDate(i.dob)} (${ageOn(i.dob, todayLocal())})`)}
              {row("Expiry", i.idExpiry ? (i.idExpiry >= "2099" ? "Lifetime" : formatDate(i.idExpiry)) : null)}
              {row("Parent", i.guardianName ? `${i.guardianName} (${i.guardianRelation})` : null)}
              {row("Parent's CNIC", i.guardianCnic ? formatIdNumber(i.guardianCnic) : null)}
              {row("Licence", i.licenseNumber)}
              {row("Issued by", auth?.name)}
              {row("Licence expiry", i.licenseExpiry ? formatDate(i.licenseExpiry) : null)}
              {row("Car registration", i.vehicleReg)}
            </dl>
          </section>

          {i.driverStatus !== "none" && (
            <section className="card space-y-2 !p-4 text-sm">
              <h2 className="font-bold">Check on official sites</h2>
              {auth?.check ? (
                <a href={auth.check} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-semibold text-brand hover:underline">
                  <ExternalLink className="size-4" /> Licence: {auth.name}
                </a>
              ) : (
                <p className="text-slate-500">Licence: check with the {auth?.name ?? "issuing"} licensing office.</p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="text-slate-500">Car {i.vehicleReg}:</span>
                {VEHICLE_CHECKS.map((v) => (
                  <a key={v.url} href={v.url} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
                    {v.name}
                  </a>
                ))}
              </div>
              <p className="text-xs text-slate-500">NADRA: the CNIC check connects here once you have NADRA Verisys or a KYC provider.</p>
            </section>
          )}

          <section className="card space-y-3 !p-4">
            <form action={approveId}>
              <input type="hidden" name="id" value={i.id} />
              <button className="btn w-full bg-emerald-600 py-3 text-white hover:bg-emerald-700" disabled={!waiting && i.riderStatus === "approved" && i.driverStatus !== "rejected"}>
                <Check className="size-5" /> Approve{i.driverStatus !== "none" ? " as driver" : ""}
              </button>
            </form>
            <form action={rejectId} className="space-y-2">
              <input type="hidden" name="id" value={i.id} />
              <select name="reason" className="input" aria-label="Reason" defaultValue={REASONS[0]}>
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button className="btn-ghost w-full !text-red-700">
                <X className="size-4" /> Turn down with this reason
              </button>
            </form>
          </section>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 font-bold">Rides as driver ({rides.length})</h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-sm">
          {rides.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
              <Link href={`/r/manage/${r.manageToken}`} target="_blank" className="font-semibold text-brand hover:underline">
                {r.car}
              </Link>
              <span className="text-slate-500">
                {formatTime(r.departTime)} · {r.kind} · {r.status} · since {formatDate(r.date)}
              </span>
            </li>
          ))}
          {rides.length === 0 && <li className="px-4 py-3 text-slate-500">None.</li>}
        </ul>
        <h2 className="mb-2 mt-5 font-bold">Bookings as rider ({bookings.length})</h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-sm">
          {bookings.map(({ b, slug, driverName, driverPhone }) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
              <span className="font-semibold">{formatDate(b.date)}</span>
              <span className="text-slate-500">
                with {driverName} ({displayPhone(driverPhone)}) · {b.seats} seat{b.seats > 1 ? "s" : ""}
              </span>
              <Link href={`/r/${slug}`} target="_blank" className="text-brand hover:underline">
                ride
              </Link>
            </li>
          ))}
          {bookings.length === 0 && <li className="px-4 py-3 text-slate-500">None.</li>}
        </ul>
        <h2 className="mb-2 mt-5 flex items-center gap-1.5 font-bold">
          <Eye className="size-4" /> Who looked at this ID
        </h2>
        <ul className="text-sm text-slate-600">
          {views.map((v, k) => (
            <li key={k}>
              {when(v.at)} · {v.admin ?? "deleted admin"} · {DOC_LABEL[v.kind] ?? v.kind}
            </li>
          ))}
          {views.length === 0 && <li>Nobody yet.</li>}
        </ul>
        <div className="mt-6">
          <ConfirmButton action={deleteId.bind(null, i.id)} confirm={`Delete ${i.fullName}'s ID data and photos for good? Their rides and bookings stay.`} className="btn-ghost !text-red-700">
            <Trash2 className="size-4" /> Delete this person&apos;s ID data and photos
          </ConfirmButton>
        </div>
      </section>
    </>
  );
}
