/*
 * GLAMNET service worker.
 *
 * Three jobs, and deliberately no more:
 *
 *  1. Push notifications — show what the server pushes, badge the app icon,
 *     and open the right page when one is tapped.
 *  2. An offline screen — when a page can't be reached at all, show
 *     /offline.html instead of the browser's dinosaur. Pages and data are never
 *     served from a cache: a booking, a price or a slot shown from yesterday
 *     is worse than an honest "you're offline".
 *  3. Keeping push alive — if the browser rotates the subscription, sign the
 *     new one up so notifications don't silently stop.
 *
 * Bump VERSION whenever the offline page or the cached icons change.
 */

const VERSION = "v3";
const SHELL_CACHE = `glamnet-shell-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const SHELL_FILES = [OFFLINE_URL, "/icon-192.png", "/badge-96.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // One file failing must not stop the worker installing: push matters more.
      .then((cache) => Promise.all(SHELL_FILES.map((file) => cache.add(new Request(file, { cache: "reload" })).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("glamnet-") && key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Only touched when the network fails: a page load gets the offline screen,
// and the few files that screen shows (the icon) come from the cache.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const shellFile = url.origin === self.location.origin && SHELL_FILES.includes(url.pathname);
  if (request.mode !== "navigate" && !shellFile) return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(SHELL_CACHE);
      if (request.mode === "navigate") return (await cache.match(OFFLINE_URL)) || Response.error();
      return (await cache.match(url.pathname)) || Response.error();
    }),
  );
});

// --- Push ---------------------------------------------------------------------

/** How many notifications arrived since the app was last opened. */
let unread = 0;

function setBadge(count) {
  if (!("setAppBadge" in self.navigator)) return Promise.resolve();
  return (count > 0 ? self.navigator.setAppBadge(count) : self.navigator.clearAppBadge()).catch(() => undefined);
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "GLAMNET";
  unread += 1;
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        // Emergency requests stay on screen until the vendor acts on them.
        requireInteraction: Boolean(data.urgent),
        vibrate: data.urgent ? [200, 100, 200, 100, 200] : [120],
        timestamp: Date.now(),
        data: { url: data.url || "/" },
      }),
      setBadge(unread),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  unread = 0;
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    Promise.all([
      setBadge(0),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
        const exact = windows.find((client) => client.url === target);
        if (exact) return exact.focus();
        const ours = windows.find((client) => new URL(client.url).origin === self.location.origin);
        if (ours && "navigate" in ours) return ours.navigate(target).then((client) => client && client.focus());
        return self.clients.openWindow(target);
      }),
    ]),
  );
});

// The app tells the worker when it has been opened, so the badge clears.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_BADGE") {
    unread = 0;
    event.waitUntil(setBadge(0));
  }
});

// Browsers occasionally replace a push subscription. Sign the new one up with
// the same account (the request carries the session cookie), or push would
// stop arriving with nobody noticing.
self.addEventListener("pushsubscriptionchange", (event) => {
  const options = event.oldSubscription && event.oldSubscription.options;
  event.waitUntil(
    (event.newSubscription
      ? Promise.resolve(event.newSubscription)
      : options
        ? self.registration.pushManager.subscribe(options)
        : Promise.resolve(null)
    )
      .then((subscription) =>
        subscription
          ? fetch("/api/push/subscribe", {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json", "x-glamnet-resubscribe": "1" },
              body: JSON.stringify(subscription.toJSON()),
            })
          : undefined,
      )
      .catch(() => undefined),
  );
});
