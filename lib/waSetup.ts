import "server-only";

/**
 * Checks the WhatsApp setup with Meta's Graph API (using the saved token), for the admin's WhatsApp page:
 * the business number, the WhatsApp Business Accounts the token reaches, and whether each one sends its
 * messages to this app's webhook (its "subscribed apps").
 */
const env = (k: string) => process.env[k]?.trim() || "";
const API = () => env("WHATSAPP_API_BASE") || "https://graph.facebook.com/v21.0";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function graph<T>(path: string, method: "GET" | "POST" = "GET"): Promise<Result<T>> {
  try {
    const res = await fetch(`${API()}/${path}`, { method, headers: { authorization: `Bearer ${env("WHATSAPP_TOKEN")}` }, cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: j?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, data: j as T };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type PhoneInfo = { display_phone_number?: string; verified_name?: string; status?: string; code_verification_status?: string; platform_type?: string; quality_rating?: string };
export type Waba = { id: string; numbers: Result<{ data: { id: string; display_phone_number: string }[] }>; apps: Result<{ data: { whatsapp_business_api_data?: { id?: string; name?: string } }[] }> };

export async function waSetup(extraWaba?: string) {
  if (!env("WHATSAPP_TOKEN") || !env("WHATSAPP_PHONE_NUMBER_ID")) return null;
  const phoneId = env("WHATSAPP_PHONE_NUMBER_ID");
  const phone = await graph<PhoneInfo>(`${phoneId}?fields=display_phone_number,verified_name,status,code_verification_status,platform_type,quality_rating`);
  // The token says which WhatsApp Business Accounts it can manage.
  const tok = await graph<{ data: { granular_scopes?: { scope: string; target_ids?: string[] }[] } }>(`debug_token?input_token=${encodeURIComponent(env("WHATSAPP_TOKEN"))}`);
  const ids = new Set<string>(extraWaba ? [extraWaba] : []);
  if (tok.ok) for (const g of tok.data.data.granular_scopes ?? []) if (g.scope.startsWith("whatsapp_business")) for (const id of g.target_ids ?? []) ids.add(id);
  // Some tokens list the phone number itself rather than its account: that isn't an account.
  ids.delete(phoneId);
  const wabas: Waba[] = await Promise.all(
    [...ids].map(async (id) => ({
      id,
      numbers: await graph<{ data: { id: string; display_phone_number: string }[] }>(`${id}/phone_numbers?fields=id,display_phone_number`),
      apps: await graph<{ data: { whatsapp_business_api_data?: { id?: string; name?: string } }[] }>(`${id}/subscribed_apps`),
    })),
  );
  return { phoneId, phone, tokenError: tok.ok ? null : tok.error, wabas };
}

/** Makes this WhatsApp Business Account send its messages to this app's webhook. */
export async function subscribeWaba(wabaId: string) {
  if (!/^\d{5,25}$/.test(wabaId)) return { ok: false as const, error: "That isn't a WhatsApp Business Account ID." };
  if (wabaId === env("WHATSAPP_PHONE_NUMBER_ID")) return { ok: false as const, error: "That's the phone number ID. Enter the WhatsApp Business Account ID instead." };
  return graph<{ success?: boolean }>(`${wabaId}/subscribed_apps`, "POST");
}
