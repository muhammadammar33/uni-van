import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, MapPin, Phone } from "lucide-react";
import { AutoRefresh, Composer, ScrollToEnd } from "@/components/admin/WaInbox";
import { requireSuper } from "@/lib/auth";
import { canReplyAfter, conversation, KIND_LABEL, markRead } from "@/lib/waInbox";
import type { WaMessage } from "@/lib/db/schema";

export const metadata = { title: "WhatsApp chat" };
export const dynamic = "force-dynamic";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Karachi";
const time = (d: Date) => d.toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Ticks({ m }: { m: WaMessage }) {
  if (m.direction !== "out") return null;
  if (m.status === "failed") return <span className="text-red-600" title={m.error ?? ""}>Not delivered</span>;
  return <span className={m.status === "read" ? "text-sky-500" : "text-slate-400"}>{m.status === "sent" ? "✓" : "✓✓"}</span>;
}

function Body({ m }: { m: WaMessage }) {
  const src = `/api/admin/wa-media/${m.id}`;
  const media = !!(m.mediaId || (m.direction === "out" && m.mime));
  switch (m.type) {
    case "image":
    case "sticker":
      return media ? (
        <a href={src} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- private media from the inbox */}
          <img src={src} alt={m.type === "sticker" ? "Sticker" : "Photo"} className={m.type === "sticker" ? "size-32" : "max-h-80 w-full rounded-lg object-cover"} loading="lazy" />
        </a>
      ) : null;
    case "audio":
      return media ? (
        <div className="space-y-1">
          <audio controls preload="none" src={src} className="w-64 max-w-full" />
          <a href={`${src}?download`} className="inline-flex items-center gap-1 text-xs text-slate-500 underline">
            <Download className="size-3" /> Download {m.direction === "in" ? "voice note" : "audio"}
          </a>
        </div>
      ) : null;
    case "video":
      return media ? <video controls preload="metadata" src={src} className="max-h-80 w-full rounded-lg" /> : null;
    case "document":
      return (
        <a href={`${src}?download`} className="flex items-center gap-2 rounded-lg bg-black/5 p-2 text-sm font-semibold">
          <FileText className="size-5 shrink-0" /> <span className="truncate">{m.fileName ?? "File"}</span> <Download className="ml-auto size-4 shrink-0" />
        </a>
      );
    case "location":
      return (
        <a href={`https://maps.google.com/?q=${encodeURIComponent(m.fileName ?? m.body ?? "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold underline">
          <MapPin className="size-4" /> Open location on map
        </a>
      );
    default:
      return null;
  }
}

/** One WhatsApp conversation: everything they sent (photos, voice notes, files) and replies. */
export default async function WhatsAppChatPage({ params }: PageProps<"/admin/whatsapp/[waId]">) {
  await requireSuper();
  const { waId } = await params;
  if (!/^\d{8,15}$/.test(waId)) notFound();
  await markRead(waId);
  const msgs = await conversation(waId);
  if (!msgs.length) notFound();
  const name = msgs.findLast((m) => m.name)?.name ?? null;
  const lastIn = msgs.findLast((m) => m.direction === "in");
  const canReply = canReplyAfter(lastIn?.createdAt);
  return (
    <div className="-mx-4 sm:mx-0">
      <AutoRefresh seconds={5} />
      <div className="flex items-center gap-3 px-4 sm:px-0">
        <Link href="/admin/whatsapp" className="grid size-9 place-items-center rounded-xl hover:bg-slate-100" aria-label="All chats">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{name ?? `+${waId}`}</h1>
          <p className="text-sm text-slate-500">+{waId}</p>
        </div>
        <a href={`tel:+${waId}`} className="grid size-10 place-items-center rounded-full border border-slate-200" aria-label="Call">
          <Phone className="size-4" />
        </a>
      </div>
      <div className="mt-3 overflow-hidden rounded-none bg-[#efeae2] sm:rounded-2xl">
        <ol className="space-y-2 p-3">
          {msgs.map((m) => (
            <li key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] space-y-1 rounded-2xl px-3 py-2 shadow-sm sm:max-w-md ${m.direction === "out" ? "rounded-br-sm bg-[#d9fdd3]" : "rounded-bl-sm bg-white"}`}>
                {m.type !== "text" && !["image", "sticker", "audio", "video", "document", "location"].includes(m.type) && <div className="text-xs font-semibold text-slate-500">{KIND_LABEL[m.type] ?? m.type}</div>}
                <Body m={m} />
                {m.body && m.type !== "document" && <p className="whitespace-pre-wrap text-[15px] [overflow-wrap:anywhere]">{m.body}</p>}
                <div className="flex justify-end gap-1.5 text-[11px] text-slate-500">
                  {time(m.createdAt)} <Ticks m={m} />
                </div>
              </div>
            </li>
          ))}
        </ol>
        <ScrollToEnd count={msgs.length} />
        {canReply ? (
          <Composer waId={waId} />
        ) : (
          <p className="border-t border-slate-200 bg-white p-3 text-sm text-slate-600">
            WhatsApp only allows replies within 24 hours of their last message. Call them, or ask them to message again.
          </p>
        )}
      </div>
    </div>
  );
}
