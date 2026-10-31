// Service Worker for TrailWeave Web Push Notifications
// Used in Track 3 (Ticket 09) for contextual in-trip transition prompts

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "TrailWeave In-Trip Update";
  const options = {
    body: data.body || "Upcoming stop arrival guidance.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: data.url || "/trip",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data || "/trip");
    })
  );
});
