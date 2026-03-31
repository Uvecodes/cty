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

  try {
    // Wait for daily-reset.js to finish its reset check before reading Firestore state
    if (window.dailyResetReady) await window.dailyResetReady;

    const snap = await userRef.get();

    let userData = {};
    let completedCount = 0;

    // Individual task state tracking
    let verseCompleted = false;
    let moralCompleted = false;
    let reflectionCompleted = false;
    let challengeCompleted = false;

    if (snap.exists) {
      userData = snap.data();
      completedCount = userData.completedCount || 0;

      // Load individual task states
      verseCompleted = userData.verseCompleted || false;
      moralCompleted = userData.moralCompleted || false;
      reflectionCompleted = userData.reflectionCompleted || false;
      challengeCompleted = userData.challengeCompleted || false;
    }

    const isAdult = userData.isAdult === true || Number(userData.age) >= 18;
    const totalDailyTasks = isAdult ? 1 : 4;

    // Determine today's date in user's timezone (prefer stored tz)
    const tz = (userData && userData.tz) || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = (typeof localDateInTZ === 'function') ? localDateInTZ(new Date(), tz) : new Date().toISOString().split('T')[0];

    // daily-reset.js has already handled the reset — just restore the current state
    if (checkbox1) checkbox1.checked = verseCompleted;
    if (checkbox2) checkbox2.checked = moralCompleted;
    if (checkbox3) checkbox3.checked = reflectionCompleted;
    if (checkbox4) checkbox4.checked = challengeCompleted;
    _saveCbCache(user.uid, today, { verseCompleted, moralCompleted, reflectionCompleted, challengeCompleted });

    // Checkbox 1 handler (Verse)
    if (checkbox1) {
      checkbox1.addEventListener("change", async function () {
        try {
          verseCompleted = checkbox1.checked;
          completedCount = (verseCompleted ? 1 : 0) + (moralCompleted ? 1 : 0) + (reflectionCompleted ? 1 : 0) + (challengeCompleted ? 1 : 0);

          const payload = {
            verseCompleted: verseCompleted,
            lastVisit: today,
            completedCount: completedCount
          };

          // Try update first (faster if doc exists), fallback to set with merge
          try {
            await userRef.update(payload);
          } catch (updateErr) {
            await userRef.set(payload, { merge: true });
          }

          _saveCbCache(user.uid, today, { verseCompleted, moralCompleted, reflectionCompleted, challengeCompleted });
          try { localStorage.setItem('cty_progress_' + today, completedCount / totalDailyTasks * 100); } catch(_e) {}

          // Write verse-read state for service worker (headless noon sync)
          // Cache API: readable by SW background push handler
          try {
            if ('caches' in window) {
              const cache = await caches.open('cty-read-state');
              await cache.put('/verse-read-state', new Response(
                JSON.stringify({ date: today, read: verseCompleted }),
                { headers: { 'Content-Type': 'application/json' } }
              ));
            }
          } catch (_e) {}
          // localStorage: fallback readable by window context
          try { localStorage.setItem('verseRead_' + today, verseCompleted ? 'true' : 'false'); } catch (_e) {}

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
          moralCompleted = checkbox2.checked;
          completedCount = (verseCompleted ? 1 : 0) + (moralCompleted ? 1 : 0) + (reflectionCompleted ? 1 : 0) + (challengeCompleted ? 1 : 0);

          const payload = {
            moralCompleted: moralCompleted,
            lastVisit: today,
            completedCount: completedCount
          };

          try {
            await userRef.update(payload);
          } catch (updateErr) {
            await userRef.set(payload, { merge: true });
          }

          _saveCbCache(user.uid, today, { verseCompleted, moralCompleted, reflectionCompleted, challengeCompleted });
          try { localStorage.setItem('cty_progress_' + today, completedCount / totalDailyTasks * 100); } catch(_e) {}

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
          reflectionCompleted = checkbox3.checked;
          completedCount = (verseCompleted ? 1 : 0) + (moralCompleted ? 1 : 0) + (reflectionCompleted ? 1 : 0) + (challengeCompleted ? 1 : 0);

          const payload = {
            reflectionCompleted: reflectionCompleted,
            lastVisit: today,
            completedCount: completedCount
          };

          try {
            await userRef.update(payload);
          } catch (updateErr) {
            await userRef.set(payload, { merge: true });
          }

          _saveCbCache(user.uid, today, { verseCompleted, moralCompleted, reflectionCompleted, challengeCompleted });
          try { localStorage.setItem('cty_progress_' + today, completedCount / totalDailyTasks * 100); } catch(_e) {}

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
          challengeCompleted = checkbox4.checked;
          completedCount = (verseCompleted ? 1 : 0) + (moralCompleted ? 1 : 0) + (reflectionCompleted ? 1 : 0) + (challengeCompleted ? 1 : 0);

          const payload = {
            challengeCompleted: challengeCompleted,
            lastVisit: today,
            completedCount: completedCount
          };

          try {
            await userRef.update(payload);
          } catch (updateErr) {
            await userRef.set(payload, { merge: true });
          }

          _saveCbCache(user.uid, today, { verseCompleted, moralCompleted, reflectionCompleted, challengeCompleted });
          try { localStorage.setItem('cty_progress_' + today, completedCount / totalDailyTasks * 100); } catch(_e) {}

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

// Retry pending resets and online recovery are handled by daily-reset.js