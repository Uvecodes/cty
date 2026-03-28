const express = require('express');
const webpush = require('web-push');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { db, admin } = require('../config/firebase-admin');
const { verifyToken } = require('../middleware/auth');
const {
  pushSubscribeLimiter,
  generalLimiter,
  reportReadLimiter,
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
 * Returns the local hour (0-23) for a given timezone.
 * Uses formatToParts for correctness — avoids locale-dependent string parsing.
 */
function getLocalHour(now, tz) {
  try {
    const parts = Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false
    }).formatToParts(now);
    const hourPart = parts.find(p => p.type === 'hour');
    if (!hourPart) return -1;
    const h = parseInt(hourPart.value, 10);
    // Some implementations return 24 for midnight; normalise to 0
    return (isNaN(h) || h === 24) ? 0 : h;
  } catch {
    return -1;
  }
}

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
    // User already opened the app today — use the exact verse they saw
    finalIndex = state.lastServedIndex;
  } else if (state && typeof state.startIndex === 'number' && state.startDate) {
    // Compute from persistent state (same formula as verses.js)
    finalIndex = computeIndex(state, dateISO, N);
  } else {
    // No state yet — derive from hash (matches first-ever serve in verses.js)
    finalIndex = stableHash(uid + ':' + groupKey) % N;
  }

  // Apply blocklist
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

// ── validation helpers ────────────────────────────────────────────────────────

// Firebase UIDs: alphanumeric + hyphen/underscore, up to 128 chars
const UID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Accepts dates within ±2 days of now (handles timezone edge cases) */
function isDateReasonable(dateStr) {
  if (!DATE_RE.test(dateStr)) return false;
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) return false;
  const now = Date.now();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  return d.getTime() >= now - twoDaysMs && d.getTime() <= now + twoDaysMs;
}

/** Shared cron authorisation check — header only, never query string */
function isCronAuthorized(req) {
  const secret = req.headers['x-cron-secret'];
  return !!(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

/**
 * Generates a short-lived HMAC token tied to uid + date.
 * Included in the silent push payload so the SW can prove the report-read
 * request originated from a legitimate server-sent push, not an arbitrary caller.
 */
function generateReadToken(uid, date) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(`${uid}:${date}`).digest('hex').slice(0, 32);
}

/** Shared VAPID guard */
function vapidConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
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
 * Uses derivedAge for accurate age-group calculation.
 */
router.post('/subscribe', pushSubscribeLimiter, verifyToken, async (req, res) => {
  const { subscription } = req.body;
  const { uid } = req.user;

  // Validate subscription shape
  if (
    !subscription ||
    typeof subscription !== 'object' ||
    typeof subscription.endpoint !== 'string' ||
    !subscription.keys ||
    typeof subscription.keys !== 'object'
  ) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  // Validate endpoint is a proper HTTPS URL
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
    // Use derivedAge (4-strategy) — same as verses.js — to avoid stale age field
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
 * POST /api/push/send-daily
 * Hourly cron. Sends a personalised morning verse notification to every user
 * whose local time is currently 7 AM.
 * Protected by X-Cron-Secret header.
 */
router.post('/send-daily', cronLimiter, async (req, res) => {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!vapidConfigured()) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  try {
    const snapshot = await db.collection('pushSubscriptions').get();
    if (snapshot.empty) {
      return res.json({ success: true, sent: 0, skipped: 0, message: 'No subscriptions found' });
    }

    const now = new Date();
    let sent = 0, skipped = 0, failed = 0;
    const toDelete = [];

    await Promise.all(snapshot.docs.map(async (doc) => {
      const { uid, subscription, tz } = doc.data();

      // Timezone filter: only send at 7 AM local time
      const localHour = getLocalHour(now, tz || 'UTC');
      if (localHour !== 7) { skipped++; return; }

      const dateISO = localDateInTZ(now, tz || 'UTC');

      try {
        // Fetch user doc for personalised verse and current age group
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) { skipped++; return; }
        const userData = userDoc.data();

        // Recompute group key from live age — handles users who had a birthday
        const userTz = getUserTZ(userData);
        const age = derivedAge(userData, userTz);
        const groupKey = ageToGroupKey(age) || '7-10';

        const verse = await getPersonalizedVerse(uid, userData, groupKey, dateISO);
        if (!verse) { failed++; return; }

        const snippet = firstNWords(verse.passage, 8);
        const payload = JSON.stringify({
          title: 'Your daily verse is here! 📖',
          body: `"${snippet}…" — ${verse.ref}`,
          icon: '/assets/icons/icon-192x192.png',
          badge: '/assets/icons/monochrome.png',
          url: '/dashboard-files/todaysverse.html'
        });

        await webpush.sendNotification(subscription, payload, {
          urgency: 'high',
          TTL: 3600 // expires after 1 hour if undelivered
        });
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          toDelete.push(uid);
        } else {
          console.error('Morning push failed:', err.message);
          failed++;
        }
      }
    }));

    if (toDelete.length > 0) {
      await Promise.all(toDelete.map(id => db.collection('pushSubscriptions').doc(id).delete()));
      console.log(`Removed ${toDelete.length} expired push subscriptions`);
    }

    res.json({ success: true, sent, skipped, failed, cleaned: toDelete.length });
  } catch (err) {
    console.error('send-daily error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/push/sync-read-state
 * Hourly cron. At noon local time, sends a silent data-only push to each device.
 * The service worker reads the verse-read state from Cache API and reports back
 * via POST /api/push/report-read so send-afternoon has up-to-date data.
 */
router.post('/sync-read-state', cronLimiter, async (req, res) => {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!vapidConfigured()) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  try {
    const snapshot = await db.collection('pushSubscriptions').get();
    if (snapshot.empty) {
      return res.json({ success: true, sent: 0, skipped: 0 });
    }

    const now = new Date();
    let sent = 0, skipped = 0, failed = 0;
    const toDelete = [];

    await Promise.all(snapshot.docs.map(async (doc) => {
      const { uid, subscription, tz } = doc.data();

      // Only fire at noon local time
      const localHour = getLocalHour(now, tz || 'UTC');
      if (localHour !== 12) { skipped++; return; }

      const dateISO = localDateInTZ(now, tz || 'UTC');

      // Data-only payload — no title/notification fields
      // Service worker checks for data.type === 'verse-read-check'
      // token is an HMAC of uid:date — validated in report-read to prove the request
      // originated from a legitimate server push, not an arbitrary caller
      const payload = JSON.stringify({
        type: 'verse-read-check',
        uid,
        date: dateISO,
        token: generateReadToken(uid, dateISO)
      });

      try {
        await webpush.sendNotification(subscription, payload, {
          urgency: 'low',
          TTL: 7200 // 2 hours — expires well before 5 PM send-afternoon
        });
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          toDelete.push(uid);
        } else {
          console.error('Sync push failed:', err.message);
          failed++;
        }
      }
    }));

    if (toDelete.length > 0) {
      await Promise.all(toDelete.map(id => db.collection('pushSubscriptions').doc(id).delete()));
    }

    res.json({ success: true, sent, skipped, failed, cleaned: toDelete.length });
  } catch (err) {
    console.error('sync-read-state error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/push/report-read
 * Called by the service worker after the silent noon push.
 * Writes the user's verse-read state to pushSubscriptions so
 * send-afternoon can read it at 5 PM.
 */
router.post('/report-read', reportReadLimiter, async (req, res) => {
  const { uid, date, read, token } = req.body;

  // Validate uid — Firebase UIDs are alphanumeric + underscore/hyphen, ≤128 chars
  if (!uid || typeof uid !== 'string' || !UID_RE.test(uid)) {
    return res.status(400).json({ error: 'Invalid uid' });
  }

  // Validate date — must be YYYY-MM-DD and within ±2 days
  if (!date || typeof date !== 'string' || !DATE_RE.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
  }
  if (!isDateReasonable(date)) {
    return res.status(400).json({ error: 'Date is outside acceptable range' });
  }

  // Validate read flag
  if (typeof read !== 'boolean') {
    return res.status(400).json({ error: 'read must be a boolean' });
  }

  // Validate HMAC token — proves this request came from a server-sent push, not an arbitrary caller
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Missing verification token' });
  }
  const expectedToken = generateReadToken(uid, date);
  if (!expectedToken || token !== expectedToken) {
    return res.status(401).json({ error: 'Invalid verification token' });
  }

  try {
    // Verify uid is a real subscriber before writing — prevents writes for arbitrary UIDs
    const subDoc = await db.collection('pushSubscriptions').doc(uid).get();
    if (!subDoc.exists) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    await db.collection('pushSubscriptions').doc(uid).set({
      verseReadDate: date,
      verseRead: read
    }, { merge: true });

    res.json({ success: true });
  } catch (err) {
    console.error('report-read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/push/send-afternoon
 * Hourly cron. At 5 PM local time, sends a game notification to every user.
 * If the user has not read today's verse, also sends a verse reminder first.
 * Read state is checked from pushSubscriptions (set by report-read) with
 * a fallback to users.verseCompleted (set directly by checkbox.js).
 */
router.post('/send-afternoon', cronLimiter, async (req, res) => {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!vapidConfigured()) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  try {
    const snapshot = await db.collection('pushSubscriptions').get();
    if (snapshot.empty) {
      return res.json({ success: true, sent: 0, skipped: 0 });
    }

    const now = new Date();
    let sent = 0, skipped = 0, failed = 0;
    const toDelete = [];

    await Promise.all(snapshot.docs.map(async (doc) => {
      const docData = doc.data();
      const { uid, subscription, tz } = docData;

      // Only send at 5 PM local time
      const localHour = getLocalHour(now, tz || 'UTC');
      if (localHour !== 17) { skipped++; return; }

      const dateISO = localDateInTZ(now, tz || 'UTC');

      try {
        // Determine if user has read today's verse.
        // Primary: pushSubscriptions.verseRead (set by report-read from headless sync)
        // Fallback: users.verseCompleted + users.lastTaskDate (set directly by checkbox.js)
        let verseReadToday = false;

        if (docData.verseReadDate === dateISO && docData.verseRead === true) {
          verseReadToday = true;
        } else {
          const userDoc = await db.collection('users').doc(uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            verseReadToday =
              userData.lastTaskDate === dateISO &&
              userData.verseCompleted === true;
          }
        }

        const payloads = [];

        // Verse reminder only if not yet read
        if (!verseReadToday) {
          payloads.push(JSON.stringify({
            title: "Haven't read today's verse yet? 📖",
            body: "Take a moment to read today's Bible verse!",
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/monochrome.png',
            url: '/dashboard-files/todaysverse.html'
          }));
        }

        // Game notification always sent
        payloads.push(JSON.stringify({
          title: "Play today's game! 🎮",
          body: verseReadToday
            ? "Great job reading today! Now test your knowledge."
            : "Challenge yourself with today's Bible game.",
          icon: '/assets/icons/icon-192x192.png',
          badge: '/assets/icons/monochrome.png',
          url: '/dashboard-files/games.html'
        }));

        for (const payload of payloads) {
          await webpush.sendNotification(subscription, payload, {
            urgency: 'normal',
            TTL: 3600
          });
          sent++;
        }
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          toDelete.push(uid);
        } else {
          console.error('Afternoon push failed:', err.message);
          failed++;
        }
      }
    }));

    if (toDelete.length > 0) {
      await Promise.all(toDelete.map(id => db.collection('pushSubscriptions').doc(id).delete()));
      console.log(`Removed ${toDelete.length} expired push subscriptions`);
    }

    res.json({ success: true, sent, skipped, failed, cleaned: toDelete.length });
  } catch (err) {
    console.error('send-afternoon error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
