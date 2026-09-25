/*
 * GLAMNET service worker — push notifications only.
 *
 * Deliberately no fetch handler: pages and data always come from the network,
 * exactly as before this file existed. It only shows notifications the server
 * pushes, and opens the right page when one is tapped.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "GLAMNET";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      // Emergency requests stay on screen until the vendor acts on them.
      requireInteraction: Boolean(data.urgent),
      vibrate: data.urgent ? [200, 100, 200, 100, 200] : [120],
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const exact = windows.find((client) => client.url === target);
      if (exact) return exact.focus();
      const ours = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (ours && "navigate" in ours) return ours.navigate(target).then((client) => client && client.focus());
      return self.clients.openWindow(target);
    }),
  );
});
