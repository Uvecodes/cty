// ---- localStorage helpers for instant checkbox restore ----
function _cbCacheKey(uid, date) { return 'cty_cb_' + uid + '_' + date; }

function _saveCbCache(uid, date, states) {
  try { localStorage.setItem(_cbCacheKey(uid, date), JSON.stringify(states)); } catch(e) {}
}

function _loadCbCache(uid, date) {
  try {
    const v = localStorage.getItem(_cbCacheKey(uid, date));
    return v ? JSON.parse(v) : null;
  } catch(e) { return null; }
}


// Call this when the page loads
async function initializeCheckboxAndProgress() {
  // Prevent duplicate initialization (multiple auth events or re-runs)
  if (window.__ctyCheckboxInitialized) {
    console.log('initializeCheckboxAndProgress: already initialized; skipping');
    return;
  }
  window.__ctyCheckboxInitialized = true;

  const checkbox1 = document.getElementById("read-checkbox1");
  const checkbox2 = document.getElementById("read-checkbox2");
  const checkbox3 = document.getElementById("read-checkbox3");
  const checkbox4 = document.getElementById("read-checkbox4");

  if (!checkbox1 && !checkbox2 && !checkbox3 && !checkbox4) return;

  const user = firebase.auth().currentUser;
  if (!user) {
    console.warn("No user logged in.");
    return;
  }

  // ---- Instant restore from localStorage (before async Firestore read) ----
  const _quickDate = (typeof localDateInTZ === 'function')
    ? localDateInTZ(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)
    : new Date().toISOString().split('T')[0];
  const _cached = _loadCbCache(user.uid, _quickDate);
  if (_cached) {
    if (checkbox1) checkbox1.checked = !!_cached.verseCompleted;
    if (checkbox2) checkbox2.checked = !!_cached.moralCompleted;
    if (checkbox3) checkbox3.checked = !!_cached.reflectionCompleted;
    if (checkbox4) checkbox4.checked = !!_cached.challengeCompleted;
  }

  const db = firebase.firestore();
  const userRef = db.collection("users").doc(user.uid);

  const totalDailyTasks = 4; // Fixed total daily tasks

  try {
    const snap = await userRef.get();

    let userData = {};
    let lastVisit = null;
    let completedCount = 0;
    let totalCount = 0;
    
    // Individual task state tracking
    let verseCompleted = false;
    let moralCompleted = false;
    let reflectionCompleted = false;
    let challengeCompleted = false;

    if (snap.exists) {
      userData = snap.data();
      lastVisit = userData.lastVisit || null;
      completedCount = userData.completedCount || 0;
      totalCount = userData.totalCount || 0;
      
      // Load individual task states
      verseCompleted = userData.verseCompleted || false;
      moralCompleted = userData.moralCompleted || false;
      reflectionCompleted = userData.reflectionCompleted || false;
      challengeCompleted = userData.challengeCompleted || false;
    }

    // Determine today's date in user's timezone (prefer stored tz)
    const tz = (userData && userData.tz) || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = (typeof localDateInTZ === 'function') ? localDateInTZ(new Date(), tz) : new Date().toISOString().split('T')[0];

    // If lastVisit is not today, attempt a transactional reset so we don't carry over yesterday's values
    if (lastVisit !== today) {
      // Reset local variables immediately for UI
      verseCompleted = false;
      moralCompleted = false;
      reflectionCompleted = false;
      challengeCompleted = false;
      completedCount = 0;

      try {
        // Run a transaction to avoid races with concurrent increments
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          const serverData = doc.exists ? doc.data() : {};
          const serverLastVisit = serverData.lastVisit || null;

          // If another client already reset for today, do nothing
          if (serverLastVisit === today) {
            return;
          }

          tx.set(userRef, {
            lastVisit: today,
            completedCount: 0,
            verseCompleted: false,
            moralCompleted: false,
            reflectionCompleted: false,
            challengeCompleted: false
          }, { merge: true });
        });

        console.log('Daily progress reset on server (transaction) for');
      } catch (resetErr) {
        // If transaction failed (offline/permission), persist a pending reset and continue with local reset
        console.warn('Failed transactional reset; saving pending reset and proceeding with local reset:');
        try {
          const key = `cty_daily_reset_${user.uid}_${today}`;
          localStorage.setItem(key, JSON.stringify({ uid: user.uid, date: today, createdAt: new Date().toISOString() }));
          console.log('Saved pending daily reset to localStorage:');
        } catch (lsErr) {
          console.warn('Failed to save pending daily reset to localStorage:');
        }
      }

      // Update UI cleared state and clear yesterday's cache
      if (checkbox1) checkbox1.checked = false;
      if (checkbox2) checkbox2.checked = false;
      if (checkbox3) checkbox3.checked = false;
      if (checkbox4) checkbox4.checked = false;
      _saveCbCache(user.uid, today, { verseCompleted: false, moralCompleted: false, reflectionCompleted: false, challengeCompleted: false });
    } else {
      // Restore today's completed state and refresh cache
      if (checkbox1) checkbox1.checked = verseCompleted;
      if (checkbox2) checkbox2.checked = moralCompleted;
      if (checkbox3) checkbox3.checked = reflectionCompleted;
      if (checkbox4) checkbox4.checked = challengeCompleted;
      _saveCbCache(user.uid, today, { verseCompleted, moralCompleted, reflectionCompleted, challengeCompleted });
    }

    // Checkbox 1 handler (Verse)
    if (checkbox1) {
      checkbox1.addEventListener("change", async function () {
        try {
          const delta = checkbox1.checked ? 1 : -1;
          verseCompleted = checkbox1.checked;

          const payload = {
            verseCompleted: verseCompleted,
            lastVisit: today,
            completedCount: firebase.firestore.FieldValue.increment(delta)
          };

          // Try update first (faster if doc exists), fallback to set with merge
          try {
            await userRef.update(payload);
          } catch (updateErr) {
            await userRef.set(payload, { merge: true });
          }

          // Update local counter in memory (clamp at zero)
          completedCount = Math.max(0, completedCount + delta);
          _saveCbCache(user.uid, today, { verseCompleted, moralCompleted, reflectionCompleted, challengeCompleted });

          // Update dashboard progress if available
          if (window.updateDashboardProgress) {
            await window.updateDashboardProgress();
          }
        } catch (error) {
          console.error('Error updating verse completion:', error);
        }
      });
    }

    // Checkbox 2 handler (Moral)
    if (checkbox2) {
      checkbox2.addEventListener("change", async function () {
        try {
          const delta = checkbox2.checked ? 1 : -1;
          moralCompleted = checkbox2.checked;

          const payload = {
            moralCompleted: moralCompleted,
            lastVisit: today,
            completedCount: firebase.firestore.FieldValue.increment(delta)
          };

          try {
            await userRef.update(payload);
          } catch (updateErr) {
            await userRef.set(payload, { merge: true });
          }

          completedCount = Math.max(0, completedCount + delta);
          _saveCbCache(user.uid, today, { verseCompleted, moralCompleted, reflectionCompleted, challengeCompleted });

          if (window.updateDashboardProgress) {
            await window.updateDashboardProgress();
          }
        } catch (error) {
          console.error('Error updating moral completion:', error);
        }
      });
    }

    // Checkbox 3 handler (Reflection)
    if (checkbox3) {
      checkbox3.addEventListener("change", async function () {
        try {
          const delta = checkbox3.checked ? 1 : -1;
          reflectionCompleted = checkbox3.checked;

          const payload = {
            reflectionCompleted: reflectionCompleted,
            lastVisit: today,
            completedCount: firebase.firestore.FieldValue.increment(delta)
          };

          try {
            await userRef.update(payload);
          } catch (updateErr) {
            await userRef.set(payload, { merge: true });
          }

          completedCount = Math.max(0, completedCount + delta);
          _saveCbCache(user.uid, today, { verseCompleted, moralCompleted, reflectionCompleted, challengeCompleted });

          if (window.updateDashboardProgress) {
            await window.updateDashboardProgress();
          }
        } catch (error) {
          console.error('Error updating reflection completion:', error);
        }
      });
    }

    // Checkbox 4 handler (Challenge)
    if (checkbox4) {
      checkbox4.addEventListener("change", async function () {
        try {
          const delta = checkbox4.checked ? 1 : -1;
          challengeCompleted = checkbox4.checked;

          const payload = {
            challengeCompleted: challengeCompleted,
            lastVisit: today,
            completedCount: firebase.firestore.FieldValue.increment(delta)
          };

          try {
            await userRef.update(payload);
          } catch (updateErr) {
            await userRef.set(payload, { merge: true });
          }

          completedCount = Math.max(0, completedCount + delta);
          _saveCbCache(user.uid, today, { verseCompleted, moralCompleted, reflectionCompleted, challengeCompleted });

          if (window.updateDashboardProgress) {
            await window.updateDashboardProgress();
          }
        } catch (error) {
          console.error('Error updating challenge completion:', error);
        }
      });
    }

    console.log(`Checkboxes initialized.`);
               
  } catch (error) {
    console.error("Error loading or saving checkbox state:", error);
  }
}

// Run after Firebase is ready (auth.js or firebase-config.js)
function setupCheckboxAuthListener() {
  if (typeof firebase === 'undefined' || !firebase.auth) return;
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      initializeCheckboxAndProgress();
    }
  });
}
if (window.firebaseReady) {
  window.firebaseReady.then(setupCheckboxAuthListener);
} else {
  window.addEventListener('firebase-ready', setupCheckboxAuthListener, { once: true });
}

// Retry pending daily resets stored in localStorage when online
async function retryPendingDailyResets() {
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.warn('retryPendingDailyResets');
    return;
  }
  const db = window.db || firebase.firestore();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('cty_daily_reset_')) continue;

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
            const serverLastVisit = serverData.lastVisit || null;

            if (serverLastVisit === payload.date) {
              // already applied
              return;
            }

            tx.set(userRef, {
              lastVisit: payload.date,
              completedCount: 0,
              verseCompleted: false,
              moralCompleted: false,
              reflectionCompleted: false,
              challengeCompleted: false
            }, { merge: true });
          });

          // success -> remove key
          localStorage.removeItem(key);
          console.log('retryPendingDailyResets: applied pending reset:');
        } catch (txErr) {
          console.warn('retryPendingDailyResets: transaction failed for');
          // keep the key for future retries
        }
      } catch (parseErr) {
        console.warn('retryPendingDailyResets: failed to parse pending reset');
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.error('retryPendingDailyResets: unexpected error');
  }
}

window.addEventListener('online', () => {
  console.log('Network online: attempting to apply pending daily resets');
  retryPendingDailyResets().catch(e => console.error('retryPendingDailyResets failed:'));
});