const express = require('express');
const webpush = require('web-push');
const path = require('path');
const fs = require('fs').promises;
const { db, admin } = require('../config/firebase-admin');
const { verifyToken } = require('../middleware/auth');
const { pushSubscribeLimiter, generalLimiter } = require('../middleware/rateLimits');
const { ageToGroupKey, localDateInTZ } = require('../utils/verse-helpers');

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

/** Deterministically picks today's verse for a group using day-of-year % count */
async function getDailyVerseForGroup(groupKey, dateISO) {
  const jsonPath = path.join(__dirname, '..', 'data', `content-${groupKey}.json`);
  const items = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  const date = new Date(dateISO + 'T00:00:00Z');
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date - startOfYear) / 86400000);
  return items[dayOfYear % items.length];
}

/** Returns the first N words of a string */
function firstNWords(text, n) {
  return text.split(/\s+/).slice(0, n).join(' ');
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
 * Requires Firebase ID token in Authorization header.
 */
router.post('/subscribe', pushSubscribeLimiter, verifyToken, async (req, res) => {
  const { subscription } = req.body;
  const { uid } = req.user;

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const tz = userData.tz || 'UTC';
    const age = userData.age || 10;
    const ageGroup = ageToGroupKey(age) || '7-10';

    await db.collection('pushSubscriptions').doc(uid).set({
      uid,
      subscription,
      tz,
      ageGroup,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Push subscription saved for uid: ${uid} (tz: ${tz}, group: ${ageGroup})`);
    res.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

/**
 * DELETE /api/push/unsubscribe
 * Removes the user's push subscription from Firestore.
 * Requires Firebase ID token in Authorization header.
 */
router.delete('/unsubscribe', verifyToken, async (req, res) => {
  const { uid } = req.user;
  try {
    await db.collection('pushSubscriptions').doc(uid).delete();
    console.log(`🔕 Push subscription removed for uid: ${uid}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

/**
 * POST /api/push/send-daily
 * Called by an external cron job every hour (e.g. cron-job.org).
 * Sends a notification to every user for whom it is currently 7 AM local time.
 * Protected by CRON_SECRET header/query param.
 */
router.post('/send-daily', async (req, res) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  try {
    const snapshot = await db.collection('pushSubscriptions').get();

    if (snapshot.empty) {
      return res.json({ success: true, sent: 0, message: 'No subscriptions found' });
    }

    const now = new Date();

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const toDelete = [];

    await Promise.all(
      snapshot.docs.map(async (doc) => {
        const { uid, subscription, tz, ageGroup } = doc.data();

        try {
          const dateISO = localDateInTZ(now, tz || 'UTC');
          const verse = await getDailyVerseForGroup(ageGroup || '7-10', dateISO);
          const snippet = firstNWords(verse.passage, 4);

          const payload = JSON.stringify({
            title: 'Your daily verse is here! 📖',
            body: `"${snippet}…" — ${verse.ref}`,
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/monochrome.png',
            url: '/dashboard-files/dashboard.html'
          });

          await webpush.sendNotification(subscription, payload);
          sent++;
        } catch (err) {
          // 410 Gone / 404 = subscription is expired or revoked → clean it up
          if (err.statusCode === 410 || err.statusCode === 404) {
            toDelete.push(uid);
          } else {
            console.error(`Push send failed for uid ${uid}:`, err.message);
            failed++;
          }
        }
      })
    );

    // Remove expired subscriptions
    if (toDelete.length > 0) {
      await Promise.all(
        toDelete.map((uid) => db.collection('pushSubscriptions').doc(uid).delete())
      );
      console.log(`🗑️ Removed ${toDelete.length} expired push subscriptions`);
    }

    console.log(`📨 Daily push: sent=${sent}, skipped=${skipped}, failed=${failed}, cleaned=${toDelete.length}`);
    res.json({ success: true, sent, skipped, failed, cleaned: toDelete.length });
  } catch (err) {
    console.error('send-daily error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
