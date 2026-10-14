import Link from "next/link";
import { Settings2 } from "lucide-react";
import { PushOptIn } from "@/components/admin/PushOptIn";
import { AutoRefresh } from "@/components/admin/WaInbox";
import { requireSuper } from "@/lib/auth";
import { conversations, preview } from "@/lib/waInbox";
import { waConfig } from "@/lib/whatsapp";

export const metadata = { title: "WhatsApp" };
export const dynamic = "force-dynamic";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Karachi";
function when(d: Date) {
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  return day(d) === day(new Date())
    ? d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
}

/** Super admin: messages people sent to the Hamsafar WhatsApp number. */
export default async function WhatsAppInboxPage() {
  await requireSuper();
  const list = await conversations();
  const number = waConfig().businessNumber;
  return (
    <>
      <AutoRefresh seconds={15} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight sm:text-3xl">WhatsApp</h1>
        <Link href="/admin/whatsapp/setup" className="btn-ghost">
          <Settings2 className="size-4" /> Setup
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">Messages, photos and voice notes sent to {number ? `+${number}` : "the Hamsafar number"}. Verification codes aren&apos;t shown here.</p>
      <div className="mt-4">
        <PushOptIn title="Get notified of new messages and IDs" />
      </div>
      <ul className="card mt-4 divide-y divide-slate-100 !p-0">
        {list.length === 0 && <li className="p-6 text-center text-sm text-slate-500">No messages yet.</li>}
        {list.map((c) => (
          <li key={c.wa_id}>
            <Link href={`/admin/whatsapp/${c.wa_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#25D366]/15 font-bold text-[#128C7E]">{(c.name ?? "#").slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={`truncate ${c.unread ? "font-extrabold" : "font-semibold"}`}>{c.name ?? `+${c.wa_id}`}</span>
                  <span className="ml-auto shrink-0 text-xs text-slate-400">{when(new Date(c.last_at))}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`truncate text-sm ${c.unread ? "text-ink" : "text-slate-500"}`}>
                    {c.direction === "out" && "You: "}
                    {preview(c.type, c.body) || "…"}
                  </span>
                  {c.unread > 0 && <span className="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-bold leading-5 text-white">{c.unread}</span>}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
