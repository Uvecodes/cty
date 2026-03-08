// daily-reset.js — checks lastTaskDate once per page load and resets Firestore if it's a new day.
// Exposes window.dailyResetReady (Promise) that resolves when the check is complete.
// Both checkbox.js and dashboard.js await this before reading Firestore state.

(function () {
  let _resolve;
  window.dailyResetReady = new Promise(function (resolve) { _resolve = resolve; });

  async function runDailyReset(user) {
    const db = firebase.firestore();
    const userRef = db.collection('users').doc(user.uid);

    try {
      const snap = await userRef.get();
      const data = snap.exists ? snap.data() : {};

      const tz = (data && data.tz) || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const today = (typeof localDateInTZ === 'function')
        ? localDateInTZ(new Date(), tz)
        : new Date().toISOString().split('T')[0];

      const lastTaskDate = data.lastTaskDate || null;

      if (lastTaskDate === today) {
        console.log('daily-reset: already up to date for', today);
        return;
      }

      // New day — run reset transaction
      try {
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const serverData = doc.exists ? doc.data() : {};
          if ((serverData.lastTaskDate || null) === today) return; // another client beat us

          tx.set(userRef, {
            lastTaskDate: today,
            completedCount: 0,
            verseCompleted: false,
            moralCompleted: false,
            reflectionCompleted: false,
            challengeCompleted: false
          }, { merge: true });
        });

        // Clear stale checkbox cache from the previous day
        try { localStorage.removeItem('cty_cb_' + user.uid + '_' + lastTaskDate); } catch (_e) {}
        // Write 0% progress cache so dashboard instant-restore shows 0 immediately
        try { localStorage.setItem('cty_progress_' + today, '0'); } catch (_e) {}

        console.log('daily-reset: reset complete for', today);
      } catch (txErr) {
        console.warn('daily-reset: transaction failed; saving pending reset:', txErr);
        try {
          const key = 'cty_daily_reset_' + user.uid + '_' + today;
          localStorage.setItem(key, JSON.stringify({ uid: user.uid, date: today, createdAt: new Date().toISOString() }));
        } catch (_e) {}
      }
    } catch (err) {
      console.error('daily-reset: error:', err);
    }
  }

  function setupResetListener() {
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        runDailyReset(user).finally(function () { _resolve(); });
      } else {
        _resolve(); // no user — unblock dependents immediately
      }
    });
  }

  if (window.firebaseReady) {
    window.firebaseReady.then(setupResetListener);
  } else {
    window.addEventListener('firebase-ready', setupResetListener, { once: true });
  }

  // ---- Retry pending daily resets when back online ----
  async function retryPendingDailyResets() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    const db = window.db || firebase.firestore();

    const resetKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cty_daily_reset_')) resetKeys.push(k);
    }

    for (const key of resetKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) { localStorage.removeItem(key); continue; }
        const payload = JSON.parse(raw);
        if (!payload || !payload.uid || !payload.date) { localStorage.removeItem(key); continue; }

        const userRef = db.collection('users').doc(payload.uid);
        try {
          await db.runTransaction(async (tx) => {
            const doc = await tx.get(userRef);
            const serverData = doc.exists ? doc.data() : {};
            if ((serverData.lastTaskDate || null) === payload.date) return;
            tx.set(userRef, {
              lastTaskDate: payload.date,
              completedCount: 0,
              verseCompleted: false,
              moralCompleted: false,
              reflectionCompleted: false,
              challengeCompleted: false
            }, { merge: true });
          });
          localStorage.removeItem(key);
          console.log('daily-reset: applied pending reset for', payload.date);
        } catch (_txErr) {
          // keep for next retry
        }
      } catch (_e) {
        localStorage.removeItem(key);
      }
    }
  }

  window.addEventListener('online', function () {
    retryPendingDailyResets().catch(function () {});
  });
})();
