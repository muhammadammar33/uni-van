import { CircleAlert, CircleCheck } from "lucide-react";
import { connectWaba } from "@/app/admin/waActions";
import { requireSuper } from "@/lib/auth";
import { verifyMode } from "@/lib/verify";
import { waConfig } from "@/lib/whatsapp";
import { waSetup } from "@/lib/waSetup";
import { webhookLog } from "@/lib/webhookLog";

export const metadata = { title: "WhatsApp" };
export const dynamic = "force-dynamic";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Karachi", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Row({ ok, label, children }: { ok: boolean; label: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 py-2 text-sm">
      {ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" />}
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <b>{label}</b>
        {children && <div className="text-slate-600">{children}</div>}
      </div>
    </li>
  );
}

/** Super admin: is WhatsApp number checking set up, and what reached the webhook. */
export default async function WhatsAppAdminPage({ searchParams }: PageProps<"/admin/whatsapp">) {
  await requireSuper();
  const sp = await searchParams;
  const extra = typeof sp.waba === "string" && /^\d{5,25}$/.test(sp.waba) ? sp.waba : undefined;
  const c = waConfig();
  const [setup, log] = await Promise.all([waSetup(extra), webhookLog()]);
  const ourNumber = c.businessNumber;
  const phone = setup?.phone;

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">WhatsApp</h1>
      <p className="mt-1 text-sm text-slate-600">Checks the WhatsApp number checking setup with Meta, and shows what reached the website.</p>
      {sp.connected && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Connected. Send a code again to test.</p>}
      {typeof sp.error === "string" && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">Meta said: {sp.error}</p>}

      <section className="card mt-5">
        <h2 className="font-bold">Setup</h2>
        <ul className="divide-y divide-slate-100">
          <Row ok={!!verifyMode()} label={verifyMode() ? `Number checks are on (${[c.canReceive && "people message us", c.canSend && "we send codes"].filter(Boolean).join(", ")})` : "Number checks are off"} />
          {!setup ? (
            <Row ok={false} label="WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing in Vercel" />
          ) : phone?.ok ? (
            <Row
              ok={phone.data.display_phone_number?.replace(/\D/g, "") === ourNumber && phone.data.platform_type === "CLOUD_API"}
              label={`Phone number ID ${setup.phoneId} is ${phone.data.display_phone_number} (${phone.data.verified_name ?? "no name"})`}
            >
              Status {phone.data.status ?? "?"} · {phone.data.platform_type ?? "?"} · verification {phone.data.code_verification_status ?? "?"}
              {phone.data.display_phone_number?.replace(/\D/g, "") !== ourNumber && ` · doesn't match WHATSAPP_BUSINESS_NUMBER (${ourNumber})`}
            </Row>
          ) : (
            <Row ok={false} label="Meta refused the phone number check">
              {phone?.error}: check WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.
            </Row>
          )}
          {setup?.tokenError && <Row ok={false} label="Couldn't read which WhatsApp accounts the token reaches">{setup.tokenError}</Row>}
        </ul>
      </section>

      {setup && (
        <section className="card mt-4">
          <h2 className="font-bold">WhatsApp Business Accounts</h2>
          <p className="text-sm text-slate-600">The account that holds your number must send its messages to this app. If it says &ldquo;not connected&rdquo;, press Connect.</p>
          {setup.wabas.length === 0 && <p className="mt-2 text-sm text-slate-500">None found from the token. Enter the account ID below (WhatsApp Manager → account settings).</p>}
          <ul className="mt-2 space-y-3">
            {setup.wabas.map((w) => {
              const numbers = w.numbers.ok ? w.numbers.data.data : [];
              const hasOurs = numbers.some((n) => n.id === setup.phoneId);
              const apps = w.apps.ok ? w.apps.data.data.map((a) => a.whatsapp_business_api_data?.name ?? a.whatsapp_business_api_data?.id ?? "an app") : [];
              return (
                <li key={w.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="font-semibold">Account {w.id}</div>
                  <div className="text-slate-600">
                    Numbers: {w.numbers.ok ? numbers.map((n) => n.display_phone_number).join(", ") || "none" : w.numbers.error}
                    {hasOurs && <b className="text-emerald-700"> · has your number</b>}
                  </div>
                  <div className={apps.length ? "text-emerald-700" : "font-semibold text-red-700"}>
                    {w.apps.ok ? (apps.length ? `Sends messages to: ${apps.join(", ")}` : "Not connected to any app: messages aren't sent to the website") : w.apps.error}
                  </div>
                  <form action={connectWaba} className="mt-2">
                    <input type="hidden" name="waba" value={w.id} />
                    <button className={hasOurs && !apps.length ? "btn-primary" : "btn-ghost"}>{apps.length ? "Connect again" : "Connect to this app"}</button>
                  </form>
                </li>
              );
            })}
          </ul>
          <form action={connectWaba} className="mt-3 flex gap-2">
            <input name="waba" className="input flex-1" inputMode="numeric" placeholder="WhatsApp Business Account ID" aria-label="WhatsApp Business Account ID" />
            <button className="btn-ghost shrink-0">Connect</button>
          </form>
        </section>
      )}

      <section className="card mt-4">
        <h2 className="font-bold">Last messages that reached the website</h2>
        {log.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">None yet. If people sent codes, Meta isn&apos;t sending them here: check the account above is connected.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {log.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 py-1.5">
                <span className="text-slate-500">{when(e.at)}</span>
                {e.from && <span>from {e.from}</span>}
                <b className={e.result === "verified" ? "text-emerald-700" : "text-slate-700"}>{e.result}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
