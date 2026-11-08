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

/** The app can keep sharing a driver's location with the screen off (a native location service). */
export const canShareInBackground = () => !!plugin("BackgroundGeolocation")?.addWatcher;

const BG_OK_KEY = "hamsafar:bg-location-ok";
/** Whether the driver already agreed to background location (shown once, as Google Play requires). */
export const backgroundLocationAccepted = () => {
  try {
    return localStorage.getItem(BG_OK_KEY) === "1";
  } catch {
    return false;
  }
};
export const acceptBackgroundLocation = () => {
  try {
    localStorage.setItem(BG_OK_KEY, "1");
  } catch {}
};

/**
 * Follows the phone's location with the native service: keeps going with the screen off or in another app,
 * with Android's "Sharing your live location" notification showing all along. Returns a function that stops it.
 */
export async function watchLocationInBackground(onPos: (lat: number, lng: number) => void, onError: (code: string) => void): Promise<() => void> {
  const bg = plugin("BackgroundGeolocation");
  if (!bg?.addWatcher) throw new Error("Background location isn't available");
  const id = (await bg.addWatcher(
    {
      backgroundTitle: "Sharing your live location",
      backgroundMessage: "Your riders can see your car on the map until you stop sharing in Hamsafar.",
      requestPermissions: true,
      stale: false,
      distanceFilter: 15,
    },
    (loc: { latitude: number; longitude: number } | undefined, err: { code?: string } | undefined) => {
      if (err) onError(err.code ?? "ERROR");
      else if (loc) onPos(loc.latitude, loc.longitude);
    },
  )) as string;
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    void bg.removeWatcher?.({ id });
  };
}
