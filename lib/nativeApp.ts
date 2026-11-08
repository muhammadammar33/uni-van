/**
 * The Hamsafar app (Capacitor) shows this website and gives it native plugins through `window.Capacitor`.
 * These helpers run in the browser; on the website they do nothing.
 */
type Plugin = Record<string, (...args: unknown[]) => Promise<unknown> | unknown>;
type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: Record<string, Plugin | undefined> };
const cap = () => (typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor);

export const APP_SCHEME = "website.hamsafar.app";
const VERIFIER_KEY = "hamsafar:app-signin";

/** True inside the Hamsafar app. */
export const inApp = () => !!cap()?.isNativePlatform?.();
export const appPlatform = () => (inApp() ? (cap()?.getPlatform?.() ?? null) : null);
export const plugin = (name: string) => (inApp() ? cap()?.Plugins?.[name] : undefined);

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * Google sign-in from the app: opens it in the phone's browser tab (Google doesn't allow it inside the app).
 * A new secret is kept on the phone; only its hash goes with the sign-in, so only this app can use the result.
 */
export async function appSignIn(next: string) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  try {
    localStorage.setItem(VERIFIER_KEY, verifier);
  } catch {}
  const url = `${location.origin}/api/auth/google?next=${encodeURIComponent(next)}&app=${challenge}`;
  const browser = plugin("Browser");
  if (browser?.open) await browser.open({ url, presentationStyle: "popover" });
  else location.assign(url);
}

/** A link the app was opened with: the sign-in hand-back, or a hamsafar.website page. Returns where to go. */
export function appLinkTarget(link: string): string | null {
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    return null;
  }
  if (u.protocol === `${APP_SCHEME}:` && u.hostname === "signed-in") {
    let verifier = "";
    try {
      verifier = localStorage.getItem(VERIFIER_KEY) ?? "";
      localStorage.removeItem(VERIFIER_KEY);
    } catch {}
    const code = u.searchParams.get("code") ?? "";
    return `/api/auth/app?code=${encodeURIComponent(code)}&verifier=${encodeURIComponent(verifier)}`;
  }
  // Ride and booking links shared as https://hamsafar.website/... open in the app on that page.
  if (/^https?:$/.test(u.protocol) && u.host === location.host) return u.pathname + u.search + u.hash;
  return null;
}
