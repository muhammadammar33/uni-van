import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Hamsafar app shows hamsafar.website full screen. The site checks for `window.Capacitor` (and the
 * "HamsafarApp" user agent) to use native features: Google sign-in in the phone's browser tab, app links.
 */
const config: CapacitorConfig = {
  appId: "website.hamsafar.app",
  appName: "Hamsafar",
  webDir: "www",
  appendUserAgent: "HamsafarApp/1.0",
  backgroundColor: "#0f766e",
  server: {
    url: "https://hamsafar.website",
    // Shown (from the app itself) when the site can't be reached: no connection.
    errorPath: "offline.html",
    // Pages that stay inside the app; any other site (WhatsApp, Google Maps...) opens outside it.
    allowNavigation: ["hamsafar.website"],
  },
  android: {
    // Only https content; no debugging of the web view in release builds.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0f766e",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      backgroundColor: "#0f766e",
      style: "DARK",
      overlaysWebView: false,
    },
  },
};

export default config;
