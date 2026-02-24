const express = require('express');
const axios = require('axios');
const { db, admin, auth } = require('../config/firebase-admin');
const { paymentVerifyLimiter } = require('../middleware/rateLimits');
const router = express.Router();

/**
 * POST /api/shop/verify-order
 * Verify a Flutterwave payment and record the shop order.
 * If a uid is provided (authenticated user), also appends to their shopHistory.
 */
router.post('/verify-order', paymentVerifyLimiter, async (req, res) => {
  const {
    transaction_id,
    product_id,
    product_name,
    amount,
    currency,
    email,
    quantity,
    size
  } = req.body;

  if (!transaction_id || !product_id || !amount || !email) {
    return res.status(400).json({ error: 'Missing required fields: transaction_id, product_id, amount, email' });
  }

  if (typeof email === 'string' && email.length > 254) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  if (product_name && typeof product_name === 'string' && product_name.length > 200) {
    return res.status(400).json({ error: 'product_name too long' });
  }

  // Resolve uid from Authorization header token (if present) — never trust client-supplied uid
  let uid = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
      uid = decoded.uid;
    } catch (_) {
      // Invalid token — treat as guest order, do not attach to any user
    }
  }

  try {
    // Guard against duplicate transactions
    const existing = await db.collection('orders')
      .where('transaction_id', '==', String(transaction_id))
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.json({ success: true, orderId: existing.docs[0].id, duplicate: true });
    }

    // Verify payment with Flutterwave
    const flwRes = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
    );

    const flwData = flwRes.data;

    if (flwData.status !== 'success' || flwData.data.status !== 'successful') {
      return res.status(400).json({ error: 'Payment verification failed', details: flwData.message });
    }

    const charged = flwData.data.amount;
    const chargedCurrency = flwData.data.currency;

    // Allow up to 1% tolerance for rounding
    if (chargedCurrency !== (currency || 'USD') || charged < amount * 0.99) {
      return res.status(400).json({
        error: 'Amount or currency mismatch',
        charged,
        expected: amount,
        currency: chargedCurrency
      });
    }

    // Build and save order record
    const orderData = {
      transaction_id: String(transaction_id),
      product_id,
      product_name,
      amount: charged,
      currency: chargedCurrency,
      email,
      quantity: quantity || 1,
      size: size || null,
      uid: uid || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const orderRef = await db.collection('orders').add(orderData);

    // If user is authenticated, save summary to their profile
    if (uid) {
      await db.collection('users').doc(uid).update({
        shopHistory: admin.firestore.FieldValue.arrayUnion({
          orderId: orderRef.id,
          product_id,
          product_name,
          amount: charged,
          currency: chargedCurrency,
          quantity: quantity || 1,
          size: size || null,
          purchasedAt: new Date().toISOString()
        })
      });
    }

    console.log(`✅ Shop order recorded: ${product_name} ×${quantity || 1} for ${email}`);

    res.json({ success: true, orderId: orderRef.id });

  } catch (err) {
    console.error('❌ Shop verify-order error:', err.message);
    res.status(500).json({ error: 'Order verification failed', message: err.message });
  }
});

module.exports = router;
