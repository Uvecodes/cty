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

  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
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

    // Set initial checkbox states based on today's completion
    if (lastVisit === today) {
      // Restore today's completed state
      checkbox1.checked = verseCompleted;
      checkbox2.checked = moralCompleted;
      checkbox3.checked = reflectionCompleted;
      checkbox4.checked = challengeCompleted;
    } else {
      // Reset all for new day
      checkbox1.checked = false;
      checkbox2.checked = false;
      checkbox3.checked = false;
      checkbox4.checked = false;
      
      // Reset individual task states
      verseCompleted = false;
      moralCompleted = false;
      reflectionCompleted = false;
      challengeCompleted = false;
    }

    // Checkbox 1 handler (Verse)
    checkbox1.addEventListener("change", async function () {
      try {
        if (checkbox1.checked) {
          verseCompleted = true;
          const newCompletedCount = completedCount + 1;
          
          await userRef.set({
            verseCompleted: true,
            completedCount: newCompletedCount,
            lastVisit: today
          }, { merge: true });
          
          completedCount = newCompletedCount;
          console.log(`Verse completed. Progress: ${completedCount}/${totalDailyTasks}`);
          
          // Update dashboard progress if available
          if (window.updateDashboardProgress) {
            await window.updateDashboardProgress();
          }
        } else {
          verseCompleted = false;
          const newCompletedCount = Math.max(0, completedCount - 1);
          
          await userRef.set({
            verseCompleted: false,
            completedCount: newCompletedCount,
            lastVisit: today
          }, { merge: true });
          
          completedCount = newCompletedCount;
          console.log(`Verse unchecked. Progress: ${completedCount}/${totalDailyTasks}`);
        }
      } catch (error) {
        console.error('Error updating verse completion:', error);
      }
    });

    // Checkbox 2 handler (Moral)
    checkbox2.addEventListener("change", async function () {
      try {
        if (checkbox2.checked) {
          moralCompleted = true;
          const newCompletedCount = completedCount + 1;
          
          await userRef.set({
            moralCompleted: true,
            completedCount: newCompletedCount,
            lastVisit: today
          }, { merge: true });
          
          completedCount = newCompletedCount;
          console.log(`Moral completed. Progress: ${completedCount}/${totalDailyTasks}`);
          
          // Update dashboard progress if available
          if (window.updateDashboardProgress) {
            await window.updateDashboardProgress();
          }
        } else {
          moralCompleted = false;
          const newCompletedCount = Math.max(0, completedCount - 1);
          
          await userRef.set({
            moralCompleted: false,
            completedCount: newCompletedCount,
            lastVisit: today
          }, { merge: true });
          
          completedCount = newCompletedCount;
          console.log(`Moral unchecked. Progress: ${completedCount}/${totalDailyTasks}`);
        }
      } catch (error) {
        console.error('Error updating moral completion:', error);
      }
    });

    // Checkbox 3 handler (Reflection)
    checkbox3.addEventListener("change", async function () {
      try {
        if (checkbox3.checked) {
          reflectionCompleted = true;
          const newCompletedCount = completedCount + 1;
          
          await userRef.set({
            reflectionCompleted: true,
            completedCount: newCompletedCount,
            lastVisit: today
          }, { merge: true });
          
          completedCount = newCompletedCount;
          console.log(`Reflection completed. Progress: ${completedCount}/${totalDailyTasks}`);
          
          // Update dashboard progress if available
          if (window.updateDashboardProgress) {
            await window.updateDashboardProgress();
          }
        } else {
          reflectionCompleted = false;
          const newCompletedCount = Math.max(0, completedCount - 1);
          
          await userRef.set({
            reflectionCompleted: false,
            completedCount: newCompletedCount,
            lastVisit: today
          }, { merge: true });
          
          completedCount = newCompletedCount;
          console.log(`Reflection unchecked. Progress: ${completedCount}/${totalDailyTasks}`);
        }
      } catch (error) {
        console.error('Error updating reflection completion:', error);
      }
    });

    // Checkbox 4 handler (Challenge)
    checkbox4.addEventListener("change", async function () {
      try {
        if (checkbox4.checked) {
          challengeCompleted = true;
          const newCompletedCount = completedCount + 1;
          
          await userRef.set({
            challengeCompleted: true,
            completedCount: newCompletedCount,
            lastVisit: today
          }, { merge: true });
          
          completedCount = newCompletedCount;
          console.log(`Challenge completed. Progress: ${completedCount}/${totalDailyTasks}`);
          
          // Update dashboard progress if available
          if (window.updateDashboardProgress) {
            await window.updateDashboardProgress();
          }
        } else {
          challengeCompleted = false;
          const newCompletedCount = Math.max(0, completedCount - 1);
          
          await userRef.set({
            challengeCompleted: false,
            completedCount: newCompletedCount,
            lastVisit: today
          }, { merge: true });
          
          completedCount = newCompletedCount;
          console.log(`Challenge unchecked. Progress: ${completedCount}/${totalDailyTasks}`);
        }
      } catch (error) {
        console.error('Error updating challenge completion:', error);
      }
    });

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