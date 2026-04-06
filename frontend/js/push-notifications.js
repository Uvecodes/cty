(function () {
  'use strict';

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const SUBSCRIBED_KEY = 'cty_push_subscribed';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
  }

  async function getIdToken() {
    const user = firebase.auth().currentUser;
    if (!user) return null;
    return user.getIdToken();
  }

  async function fetchVapidKey() {
    const res = await fetch(`${window.API_BASE}/api/push/vapid-public-key`);
    if (!res.ok) throw new Error('Could not fetch VAPID key');
    const { publicKey } = await res.json();
    return publicKey;
  }

  async function saveSubscriptionToServer(subscription) {
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${window.API_BASE}/api/push/subscribe`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({ subscription })
    });
    if (!res.ok) throw new Error('Failed to save subscription on server');
  }

  async function removeSubscriptionFromServer() {
    const token = await getIdToken();
    if (!token) return;
    await fetch(`${window.API_BASE}/api/push/unsubscribe`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest'
      }
    }).catch(() => {});
  }

  // ── Public API (used by profile page toggle) ─────────────────────────────

  window.PushNotifications = {
    async isSubscribed() {
      if (Notification.permission !== 'granted') return false;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    },

    async enable() {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const vapidKey = await fetchVapidKey();
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
      await saveSubscriptionToServer(pushSub.toJSON());
      localStorage.setItem(SUBSCRIBED_KEY, '1');
      return true;
    },

    async disable() {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await removeSubscriptionFromServer();
      localStorage.removeItem(SUBSCRIBED_KEY);
    }
  };

  // ── Auto-subscribe on first dashboard visit ───────────────────────────────

  async function autoSubscribe() {
    if (!window.location.pathname.includes('dashboard')) return;

    // Already subscribed — sync localStorage and re-save to server so Firestore
    // stays in sync even if the record was cleaned up by a previous broadcast.
    if (await window.PushNotifications.isSubscribed()) {
      localStorage.setItem(SUBSCRIBED_KEY, '1');
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await saveSubscriptionToServer(sub.toJSON());
      } catch (_err) { /* silently ignore — subscription will retry next visit */ }
      return;
    }

    // User already denied — don't re-ask (they can re-enable from profile)
    if (Notification.permission === 'denied') return;

    // Auto-request permission and subscribe
    try {
      await window.PushNotifications.enable();
    } catch (_err) {
      // Silently fail — user can enable from profile page
    }
  }

  function waitForAuth(cb) {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0 && firebase.auth) {
      const unsub = firebase.auth().onAuthStateChanged((user) => {
        unsub();
        if (user) cb();
      });
    } else if (window.firebaseReady) {
      window.firebaseReady.then(() => waitForAuth(cb)).catch(() => {});
    } else {
      window.addEventListener('firebase-ready', () => waitForAuth(cb), { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForAuth(autoSubscribe));
  } else {
    waitForAuth(autoSubscribe);
  }
})();
