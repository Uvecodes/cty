(function () {
  'use strict';

  const DISMISSED_KEY = 'cty_push_dismissed';
  const SUBSCRIBED_KEY = 'cty_push_subscribed';

  // Only run on dashboard pages
  if (!window.location.pathname.includes('dashboard')) return;

  // Require browser support
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  // ── utilities ───────────────────────────────────────────────────────────────

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

  // ── banner UI ───────────────────────────────────────────────────────────────

  function createBanner(subscribed) {
    const banner = document.createElement('div');
    banner.id = 'push-banner';
    banner.style.cssText = [
      'display:flex', 'align-items:center', 'gap:12px',
      'background:linear-gradient(135deg,#16a34a,#15803d)',
      'color:#fff', 'padding:14px 18px', 'border-radius:14px',
      'margin:0 16px 18px', 'box-shadow:0 4px 16px rgba(22,163,74,0.3)',
      'font-family:inherit'
    ].join(';');

    if (subscribed) {
      banner.innerHTML = `
        <span style="font-size:1.5rem;flex-shrink:0;">🔔</span>
        <span style="flex:1;font-size:0.92rem;line-height:1.4;">
          <strong>Daily reminders on!</strong>
          We'll notify you at 7 AM with your verse.
        </span>
        <button id="push-off-btn" style="
          background:rgba(255,255,255,0.2);border:none;color:#fff;
          padding:6px 14px;border-radius:20px;font-size:0.82rem;
          cursor:pointer;white-space:nowrap;font-family:inherit;">
          Turn off
        </button>`;
    } else {
      banner.innerHTML = `
        <span style="font-size:1.5rem;flex-shrink:0;">🔔</span>
        <div style="flex:1;">
          <strong style="display:block;font-size:0.95rem;">Get daily reminders</strong>
          <span style="font-size:0.82rem;opacity:0.9;">
            We'll remind you at 7 AM with your verse of the day.
          </span>
        </div>
        <button id="push-enable-btn" style="
          background:#fff;color:#16a34a;border:none;
          padding:8px 16px;border-radius:20px;font-size:0.85rem;
          font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;">
          Enable
        </button>
        <button id="push-dismiss-btn" style="
          background:none;border:none;color:rgba(255,255,255,0.7);
          font-size:1.2rem;cursor:pointer;padding:2px 6px;line-height:1;
          flex-shrink:0;" aria-label="Dismiss">
          ✕
        </button>`;
    }

    return banner;
  }

  function insertBanner(banner) {
    // Insert after the welcome section so it feels contextual
    const welcome = document.querySelector('.welcome-section');
    if (welcome && welcome.parentNode) {
      welcome.parentNode.insertBefore(banner, welcome.nextSibling);
    } else {
      const main = document.querySelector('.dashboard-content') || document.body;
      main.prepend(banner);
    }
  }

  function removeBanner() {
    const el = document.getElementById('push-banner');
    if (el) el.remove();
  }

  // ── subscribe / unsubscribe ─────────────────────────────────────────────────

  async function subscribe() {
    const btn = document.getElementById('push-enable-btn');
    if (btn) { btn.textContent = 'Enabling…'; btn.disabled = true; }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (btn) { btn.textContent = 'Enable'; btn.disabled = false; }
        return;
      }

      const vapidKey = await fetchVapidKey();
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      await saveSubscriptionToServer(pushSub.toJSON());
      localStorage.setItem(SUBSCRIBED_KEY, '1');

      // Swap banner to "subscribed" state
      removeBanner();
      const newBanner = createBanner(true);
      insertBanner(newBanner);
      document.getElementById('push-off-btn').addEventListener('click', unsubscribe);
    } catch (err) {
      console.error('Push subscribe failed:', err);
      if (btn) { btn.textContent = 'Enable'; btn.disabled = false; }
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await removeSubscriptionFromServer();
      localStorage.removeItem(SUBSCRIBED_KEY);
      localStorage.setItem(DISMISSED_KEY, '1'); // treat opt-out as dismissed
      removeBanner();
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
    }
  }

  // ── init ────────────────────────────────────────────────────────────────────

  async function init() {
    const isDismissed = localStorage.getItem(DISMISSED_KEY);

    // Check real subscription state from browser (source of truth)
    let isSubscribed = false;
    if (Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      isSubscribed = !!sub;
      if (isSubscribed) {
        localStorage.setItem(SUBSCRIBED_KEY, '1');
      } else {
        localStorage.removeItem(SUBSCRIBED_KEY);
      }
    }

    // Don't show the opt-in banner if user already dismissed and isn't subscribed
    if (!isSubscribed && isDismissed) return;

    const banner = createBanner(isSubscribed);
    insertBanner(banner);

    if (isSubscribed) {
      document.getElementById('push-off-btn').addEventListener('click', unsubscribe);
    } else {
      document.getElementById('push-enable-btn').addEventListener('click', subscribe);
      document.getElementById('push-dismiss-btn').addEventListener('click', () => {
        localStorage.setItem(DISMISSED_KEY, '1');
        removeBanner();
      });
    }
  }

  // Wait for Firebase auth before showing the banner (needs currentUser for token)
  function waitForAuth(cb) {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      const unsub = firebase.auth().onAuthStateChanged((user) => {
        unsub();
        if (user) cb();
      });
    } else {
      window.addEventListener('firebase-ready', () => waitForAuth(cb), { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForAuth(init));
  } else {
    waitForAuth(init);
  }
})();
