const express = require('express');
const webpush = require('web-push');
const path = require('path');
const fs = require('fs').promises;
const { db, admin } = require('../config/firebase-admin');
const { verifyToken } = require('../middleware/auth');
const {
  pushSubscribeLimiter,
  generalLimiter,
  cronLimiter
} = require('../middleware/rateLimits');
const {
  ageToGroupKey,
  localDateInTZ,
  stableHash,
  computeIndex,
  applyBlocklist,
  derivedAge,
  getUserTZ
} = require('../utils/verse-helpers');

const router = express.Router();

// Set VAPID credentials once at module load
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@tenderoots.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Computes the personalised verse for a user using the same stableHash + computeIndex
 * logic as GET /api/verses/today, so the notification matches what they will see.
 */
async function getPersonalizedVerse(uid, userData, groupKey, dateISO) {
  const jsonPath = path.join(__dirname, '..', 'data', `content-${groupKey}.json`);
  let items;
  try {
    const raw = await fs.readFile(jsonPath, 'utf8');
    items = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(items) || items.length === 0) return null;

  const N = items.length;
  const state = userData.contentState && userData.contentState[groupKey]
    ? userData.contentState[groupKey]
    : null;

  let finalIndex;
  if (
    state &&
    state.lastServedDate === dateISO &&
    typeof state.lastServedIndex === 'number' &&
    state.lastServedIndex >= 0
  ) {
    finalIndex = state.lastServedIndex;
  } else if (state && typeof state.startIndex === 'number' && state.startDate) {
    finalIndex = computeIndex(state, dateISO, N);
  } else {
    finalIndex = stableHash(uid + ':' + groupKey) % N;
  }

  if (
    userData.blockedRefs &&
    Array.isArray(userData.blockedRefs) &&
    userData.blockedRefs.length > 0
  ) {
    finalIndex = applyBlocklist(finalIndex, items, userData.blockedRefs);
  }

  return items[Math.max(0, Math.min(finalIndex, N - 1))] || null;
}

/** Returns the first n words of a string */
function firstNWords(text, n) {
  if (!text || typeof text !== 'string') return '';
  return text.split(/\s+/).slice(0, n).join(' ');
}

/** Shared cron authorisation check — header only, never query string */
function isCronAuthorized(req) {
  const secret = req.headers['x-cron-secret'];
  return !!(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

/** Shared VAPID guard */
function vapidConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Sends a push payload to every subscriber in a snapshot.
 * Deletes stale (410/404) subscriptions automatically.
 * Returns { sent, failed, cleaned }.
 */
async function broadcastToAll(snapshot, payloadFn) {
  let sent = 0, failed = 0;
  const toDelete = [];

  await Promise.all(snapshot.docs.map(async (doc) => {
    const { uid, subscription } = doc.data();
    try {
      const payload = typeof payloadFn === 'function'
        ? await payloadFn(uid, doc.data())
        : payloadFn;
      await webpush.sendNotification(subscription, payload, {
        urgency: 'high',
        TTL: 3600
      });
      sent++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        toDelete.push(uid);
      } else {
        console.error('Push send failed:', err.message);
        failed++;
      }
    }
  }));

  if (toDelete.length > 0) {
    await Promise.all(toDelete.map(id =>
      db.collection('pushSubscriptions').doc(id).delete()
    ));
  }

  return { sent, failed, cleaned: toDelete.length };
}

// ── routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key so the frontend can create a push subscription.
 * Public — no auth required.
 */
router.get('/vapid-public-key', generalLimiter, (_req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

/**
 * POST /api/push/subscribe
 * Saves the user's push subscription to Firestore.
 */
router.post('/subscribe', pushSubscribeLimiter, verifyToken, async (req, res) => {
  const { subscription } = req.body;
  const { uid } = req.user;

  if (
    !subscription ||
    typeof subscription !== 'object' ||
    typeof subscription.endpoint !== 'string' ||
    !subscription.keys ||
    typeof subscription.keys !== 'object'
  ) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  try {
    const ep = new URL(subscription.endpoint);
    if (ep.protocol !== 'https:' && ep.protocol !== 'http:') {
      return res.status(400).json({ error: 'Invalid subscription endpoint protocol' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid subscription endpoint URL' });
  }

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const tz = getUserTZ(userData);
    const age = derivedAge(userData, tz);
    const ageGroup = ageToGroupKey(age) || '7-10';

    await db.collection('pushSubscriptions').doc(uid).set({
      uid,
      subscription,
      tz,
      ageGroup,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

/**
 * DELETE /api/push/unsubscribe
 * Removes the user's push subscription from Firestore.
 */
router.delete('/unsubscribe', verifyToken, async (req, res) => {
  const { uid } = req.user;
  try {
    await db.collection('pushSubscriptions').doc(uid).delete();
    res.json({ success: true });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

/**
 * POST /api/push/send-morning
 * Fires at 7 AM ET. Sends a personalised verse snippet to every subscriber.
 * No timezone filtering — broadcasts to all users at once.
 * Set your cron to: 7:00 AM America/New_York daily.
 */
router.post('/send-morning', cronLimiter, async (req, res) => {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!vapidConfigured()) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  try {
    const snapshot = await db.collection('pushSubscriptions').get();
    if (snapshot.empty) {
      return res.json({ success: true, sent: 0, failed: 0, cleaned: 0 });
    }

    const result = await broadcastToAll(snapshot, async (uid) => {
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const tz = getUserTZ(userData);
      const dateISO = localDateInTZ(new Date(), tz);
      const age = derivedAge(userData, tz);
      const groupKey = ageToGroupKey(age) || '7-10';
      const verse = await getPersonalizedVerse(uid, userData, groupKey, dateISO);
      const body = verse
        ? `"${firstNWords(verse.passage, 8)}…" — ${verse.ref}`
        : "Open the app to read today's verse!";

      return JSON.stringify({
        title: 'Your daily verse is here! 📖',
        body,
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/monochrome.png',
        url: '/dashboard-files/todaysverse.html'
      });
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('send-morning error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/push/send-noon
 * Fires at 1 PM ET. Asks all subscribers if they have read today's verse.
 * Always sends to everyone — no read-state check.
 * Set your cron to: 1:00 PM America/New_York daily.
 */
router.post('/send-noon', cronLimiter, async (req, res) => {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!vapidConfigured()) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  try {
    const snapshot = await db.collection('pushSubscriptions').get();
    if (snapshot.empty) {
      return res.json({ success: true, sent: 0, failed: 0, cleaned: 0 });
    }

    const payload = JSON.stringify({
      title: "Have you read today's verse? 📖",
      body: "Take a moment to read today's Bible verse!",
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/monochrome.png',
      url: '/dashboard-files/todaysverse.html'
    });

    const result = await broadcastToAll(snapshot, payload);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('send-noon error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/push/send-evening
 * Fires at 5 PM ET. Sends a game reminder to every subscriber.
 * Set your cron to: 5:00 PM America/New_York daily.
 */
router.post('/send-evening', cronLimiter, async (req, res) => {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!vapidConfigured()) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  try {
    const snapshot = await db.collection('pushSubscriptions').get();
    if (snapshot.empty) {
      return res.json({ success: true, sent: 0, failed: 0, cleaned: 0 });
    }

    const payload = JSON.stringify({
      title: "Play today's game! 🎮",
      body: "Challenge yourself with today's Bible game.",
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/monochrome.png',
      url: '/dashboard-files/games.html'
    });

    const result = await broadcastToAll(snapshot, payload);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('send-evening error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
