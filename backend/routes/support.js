const express = require('express');
const axios = require('axios');
const { db } = require('../config/firebase-admin');
const { paymentVerifyLimiter, publicReadLimiter } = require('../middleware/rateLimits');

const router = express.Router();

// =============================================
// GET /api/support/public-config
// Serves Flutterwave public key to the frontend
// =============================================
router.get('/public-config', (req, res) => {
  const flwPublicKey = process.env.FLW_PUBLIC_KEY;
  if (!flwPublicKey) {
    console.error('❌ FLW_PUBLIC_KEY not set in .env');
    return res.status(500).json({ error: 'Payment configuration missing' });
  }
  res.json({ flwPublicKey });
});

// =============================================
// POST /api/support/verify-payment
// Verifies a Flutterwave transaction and records the donation
// =============================================
router.post('/verify-payment', paymentVerifyLimiter, async (req, res) => {
  const { transaction_id, amount, currency, type, opted_in_name } = req.body;

  if (!transaction_id || !amount || !currency) {
    return res.status(400).json({ error: 'transaction_id, amount and currency are required' });
  }

  if (opted_in_name && opted_in_name.trim().length > 100) {
    return res.status(400).json({ error: 'opted_in_name must be 100 characters or fewer' });
  }

  if (!process.env.FLW_SECRET_KEY) {
    console.error('❌ FLW_SECRET_KEY not set in .env');
    return res.status(500).json({ error: 'Payment service not configured' });
  }

  try {
    // Guard against duplicate transactions BEFORE calling Flutterwave API
    const existingSnap = await db.collection('donations')
      .where('flw_tx_id', '==', String(transaction_id))
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      console.log(`ℹ️  Duplicate transaction ignored: ${transaction_id}`);
      return res.json({ success: true, duplicate: true });
    }

    // Verify with Flutterwave API
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
    );

    const txData = response.data.data;

    if (
      response.data.status !== 'success' ||
      txData.status !== 'successful' ||
      parseFloat(txData.amount) < parseFloat(amount) ||
      txData.currency !== currency
    ) {
      console.warn('⚠️ Payment verification mismatch:', {
        expected: { amount, currency },
        received: { amount: txData.amount, currency: txData.currency, status: txData.status }
      });
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Build anonymized display string
    const formattedAmount = `${currency} ${txData.amount}`;
    const display = `Someone donated ${formattedAmount}`;

    const donationData = {
      amount: txData.amount,
      currency: txData.currency,
      type: type || 'one-time',
      timestamp: new Date(),
      display,
      verified: true,
      flw_tx_id: String(transaction_id),
    };

    if (opted_in_name && opted_in_name.trim()) {
      donationData.opted_in_name = opted_in_name.trim();
    }

    await db.collection('donations').add(donationData);

    // Increment supporters count in stats doc
    const statsRef = db.collection('stats').doc('public');
    await db.runTransaction(async (tx) => {
      const statsDoc = await tx.get(statsRef);
      const current = statsDoc.exists ? (statsDoc.data().supporters || 0) : 0;
      tx.set(statsRef, { supporters: current + 1 }, { merge: true });
    });

    console.log(`✅ Donation recorded: ${formattedAmount} (${type || 'one-time'})`);
    res.json({ success: true });

  } catch (err) {
    console.error('❌ Payment verification error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// =============================================
// GET /api/support/stats
// Returns live stats for the Numbers section
// =============================================
router.get('/stats', publicReadLimiter, async (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  try {
    const statsDoc = await db.collection('stats').doc('public').get();
    const saved = statsDoc.exists ? statsDoc.data() : {};

    // Count registered users via aggregation (firebase-admin v12 supports this)
    let childrenReached = saved.childrenReached || 0;
    try {
      const usersCount = await db.collection('users').count().get();
      childrenReached = usersCount.data().count;
      // Cache it non-blocking
      db.collection('stats').doc('public')
        .set({ childrenReached }, { merge: true })
        .catch(() => {});
    } catch (e) {
      console.warn('⚠️ Could not count users, using cached value:', e.message);
    }

    const supporters = saved.supporters || 0;
    // versesDelivered: estimate (30 per user) or manually set in stats doc
    const versesDelivered = saved.versesDelivered || (childrenReached > 0 ? childrenReached * 30 : 0);

    res.json({ childrenReached, versesDelivered, supporters });

  } catch (err) {
    console.error('❌ Stats error:', err.message);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// =============================================
// GET /api/support/activity
// Returns latest 10 anonymized donations for the activity feed
// =============================================
router.get('/activity', publicReadLimiter, async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  try {
    const snap = await db.collection('donations')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const activity = snap.docs.map(doc => {
      const data = doc.data();
      const ts = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
      return {
        display: data.display,
        type: data.type,
        relativeTime: relativeTime(ts),
      };
    });

    res.json({ activity });

  } catch (err) {
    console.error('❌ Activity error:', err.message);
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

// =============================================
// GET /api/support/credits
// Returns opted-in supporter names grouped by tier
// =============================================
router.get('/credits', publicReadLimiter, async (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  try {
    const snap = await db.collection('donations')
      .orderBy('timestamp', 'desc')
      .limit(500)
      .get();

    const supporters = [];
    const partners = [];
    const seen = new Set();

    snap.docs.forEach(doc => {
      const data = doc.data();
      if (!data.opted_in_name || seen.has(data.opted_in_name)) return;
      seen.add(data.opted_in_name);
      if (data.type === 'monthly') {
        partners.push(data.opted_in_name);
      } else {
        supporters.push(data.opted_in_name);
      }
    });

    res.json({ supporters, partners });

  } catch (err) {
    console.error('❌ Credits error:', err.message);
    res.status(500).json({ error: 'Failed to load credits' });
  }
});

// =============================================
// Helper: format a Date as relative time string
// =============================================
function relativeTime(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (weeks < 5) return `${weeks}w`;
  return `${months}mo`;
}

module.exports = router;
