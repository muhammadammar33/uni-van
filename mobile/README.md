# Hamsafar app (Android, later iPhone)

The app is [Capacitor](https://capacitorjs.com): a native shell that shows **https://hamsafar.website** full
screen. Pages and features come from the website, so website updates reach the app at once. Native parts:

- **Google sign-in** opens in the phone's browser tab (Google blocks sign-in inside apps' web views) and
  returns through `website.hamsafar.app://signed-in` with a one-time code (see `lib/appSignIn.ts`).
- **Links**: `https://hamsafar.website/r/…`, `/t/…`, `/o/…`, `/d/…`, `/search`, `/offer`, `/me` open in the app
  once `ANDROID_CERT_SHA256` is set on the website (serves `/.well-known/assetlinks.json`).
- **No connection**: `www/offline.html`, with a Try again button.
- The website knows it's in the app from `window.Capacitor` and the `HamsafarApp/1.0` user agent.

## Build

Needs Node 22, JDK 21 and the Android SDK (platform 36).

```bash
cd mobile
npm ci
npm run android:debug        # → android/app/build/outputs/apk/debug/app-debug.apk
```

GitHub Actions (`.github/workflows/android.yml`) builds a debug APK on every change to `mobile/`
(download it from the run's **Artifacts**), and a signed release on tags like `app-v1.0.0`.

## Release signing (once)

1. Create the upload key (keep the file and passwords safe, outside the repository):
   `keytool -genkeypair -v -keystore hamsafar-upload.jks -alias hamsafar -keyalg RSA -keysize 2048 -validity 10000`
2. In GitHub → Settings → Secrets → Actions add: `ANDROID_KEYSTORE_BASE64` (`base64 -w0 hamsafar-upload.jks`),
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`hamsafar`), `ANDROID_KEY_PASSWORD`.
3. Tag a release: `git tag app-v1.0.0 && git push origin app-v1.0.0` → the AAB for Google Play is in the run's Artifacts.
4. After the first upload, copy the **App signing key** SHA-256 from Play Console → App integrity into the
   website's `ANDROID_CERT_SHA256` (Vercel) so hamsafar.website links open in the app.

## Icons and splash

Sources in `assets/` (made from the site's logo); regenerate with `npm run assets`.
