// Hamsafar service worker: shows the owner's notifications (new ID to verify, new WhatsApp message) and opens
// the page on tap. Open Hamsafar pages are told too, so they show the news without a manual refresh.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "Hamsafar", {
        body: data.body || "",
        // The logo in the notification; the status-bar icon must be a white shape on transparent (Android).
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        tag: data.tag || "hamsafar-admin",
        renotify: true,
        data: { url: data.url || "/admin/verifications" },
      }),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => wins.forEach((w) => w.postMessage({ type: "hamsafar-push", url: data.url }))),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/admin/verifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if (w.url.startsWith(self.location.origin) && "focus" in w) return w.navigate(url).then((c) => c && c.focus());
      return self.clients.openWindow(url);
    }),
  );
});
