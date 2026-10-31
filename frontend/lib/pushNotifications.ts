/**
 * Web Push Service Worker & Notification Helper for Track 3 (Ticket 09)
 * Registers sw.js, manages push permissions, and delivers native lockscreen notifications.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PushNotificationPayload {
  title: string;
  body: string;
  gate_tip?: string;
  weather_tip?: string;
  scenic_tip?: string;
  url?: string;
  next_stop_id?: string;
}

/**
 * Register Service Worker (/sw.js)
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return registration;
  } catch (err) {
    console.warn("ServiceWorker registration failed:", err);
    return null;
  }
}

/**
 * Request notification permission from traveler
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return "denied";
  }
}

/**
 * Subscribe traveler to Web Push on backend
 */
export async function subscribeToTripPush(tripId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const perm = await requestNotificationPermission();
    if (perm !== "granted") return false;

    const registration = await registerServiceWorker();
    if (!registration) return false;

    // Send dummy/FCM subscription endpoint to backend for tracking
    const fakeEndpoint = `https://fcm.googleapis.com/fcm/send/trip_${tripId}_${Date.now()}`;
    await fetch(`${API_BASE_URL}/api/trips/${tripId}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: fakeEndpoint,
        keys: { p256dh: "key_p256dh", auth: "key_auth" },
      }),
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger transition notification on stop departure checkout
 */
export async function dispatchTransitionNotification(
  payload: PushNotificationPayload
): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration && "showNotification" in registration) {
      await registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: payload.url || "/trip",
      });
      return;
    }

    // Direct Notification fallback if service worker inactive
    new Notification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
    });
  } catch (err) {
    console.warn("Failed to dispatch push notification:", err);
  }
}

