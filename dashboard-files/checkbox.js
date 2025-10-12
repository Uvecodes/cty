// Call this when the page loads
async function initializeCheckboxAndProgress() {
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

    // If lastVisit is not today, reset server-side daily state so we don't carry over yesterday's values
    if (lastVisit !== today) {
      // Reset local variables
      verseCompleted = false;
      moralCompleted = false;
      reflectionCompleted = false;
      challengeCompleted = false;
      completedCount = 0;

      try {
        await userRef.set({
          lastVisit: today,
          completedCount: 0,
          verseCompleted: false,
          moralCompleted: false,
          reflectionCompleted: false,
          challengeCompleted: false
        }, { merge: true });
        console.log('Daily progress reset on server for', today);
      } catch (resetErr) {
        console.warn('Failed to reset daily progress on server; proceeding with local reset:', resetErr);
      }

      // Update UI cleared state
      if (checkbox1) checkbox1.checked = false;
      if (checkbox2) checkbox2.checked = false;
      if (checkbox3) checkbox3.checked = false;
      if (checkbox4) checkbox4.checked = false;
    } else {
      // Restore today's completed state
      if (checkbox1) checkbox1.checked = verseCompleted;
      if (checkbox2) checkbox2.checked = moralCompleted;
      if (checkbox3) checkbox3.checked = reflectionCompleted;
      if (checkbox4) checkbox4.checked = challengeCompleted;
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

          console.log(`Verse ${verseCompleted ? 'completed' : 'unchecked'}. Progress: ${completedCount}/${totalDailyTasks}`);

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
          console.log(`Moral ${moralCompleted ? 'completed' : 'unchecked'}. Progress: ${completedCount}/${totalDailyTasks}`);

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
          console.log(`Reflection ${reflectionCompleted ? 'completed' : 'unchecked'}. Progress: ${completedCount}/${totalDailyTasks}`);

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
          console.log(`Challenge ${challengeCompleted ? 'completed' : 'unchecked'}. Progress: ${completedCount}/${totalDailyTasks}`);

          if (window.updateDashboardProgress) {
            await window.updateDashboardProgress();
          }
        } catch (error) {
          console.error('Error updating challenge completion:', error);
        }
      });
    }

    console.log(`Checkboxes initialized. Current progress: ${completedCount}/${totalDailyTasks}`);
               
  } catch (error) {
    console.error("Error loading or saving checkbox state:", error);
  }
}

// Make sure Firebase auth is ready
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    initializeCheckboxAndProgress();
  }
});