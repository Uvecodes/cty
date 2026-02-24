// Dashboard Logic - Firebase v8 Compatible
// Firebase is initialized by auth-v2.js (fetch from API); run only after firebase-ready
(function() {
  function runWhenFirebaseReady() {
    const auth = firebase.auth();
    const db = firebase.firestore();

  // Toast notification function (same as auth.js)
  function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    if (!toast) return;

    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    toast.timeoutId = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.classList.add("hidden");
      }, 300);
    }, 3000);
  }

  // Function to get time-based greeting
  function getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }

  // ---- Mood face ----
  function updateFace(pct) {
    const face = document.getElementById('progress-face');
    if (!face) return;
    const stage = pct === 0 ? '😢' : pct < 50 ? '😐' : pct < 100 ? '😊' : '🥳';
    if (face.textContent !== stage) {
      face.textContent = stage;
      face.classList.add('pop');
      setTimeout(() => face.classList.remove('pop'), 300);
    }
  }

  // ---- Celebration popup ----
  function spawnConfetti() {
    const container = document.getElementById('celebrationConfetti');
    if (!container) return;
    container.innerHTML = '';
    const colours = ['#f9c74f', '#43aa8b', '#f94144', '#577590', '#90be6d', '#f3722c'];
    for (let i = 0; i < 22; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colours[Math.floor(Math.random() * colours.length)];
      piece.style.animationDelay = (Math.random() * 0.9).toFixed(2) + 's';
      piece.style.animationDuration = (1.2 + Math.random() * 0.8).toFixed(2) + 's';
      container.appendChild(piece);
    }
  }

  function showCelebration() {
    const modal = document.getElementById('celebrationModal');
    if (!modal) return;
    modal.hidden = false;
    spawnConfetti();
  }

  function maybeCelebrate(pct) {
    if (pct < 100) return;
    const today = new Date().toISOString().split('T')[0];
    const key = 'celebrationShown';
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
    showCelebration();
  }

  // ---- Wire close button ----
  document.getElementById('closeCelebration')?.addEventListener('click', () => {
    const modal = document.getElementById('celebrationModal');
    if (modal) modal.hidden = true;
  });

  // Function to update progress bar with user completion data
  async function updateProgressBar() {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('No user logged in, cannot update progress bar');
        return;
      }

      // Get user document from Firestore
      const userDoc = await db.collection("users").doc(user.uid).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        
        // Calculate progress based on completed tasks
        // Using the correct field name from checkbox.js
        const completedTasks = userData.completedCount || 0;
        const totalTasks = 4;
        const progressPercentage = Math.min((completedTasks / totalTasks) * 100, 100);
        
        // Update progress bar width
        const progressBarFill = document.getElementById('progress-bar-fill');
        if (progressBarFill) {
          progressBarFill.style.width = `${progressPercentage}%`;
          console.log('Progress bar updated:', progressPercentage + '%');
        }
        
        // Update progress percentage text
        const progressPercentageElement = document.querySelector('.progress-percentage');
        if (progressPercentageElement) {
          progressPercentageElement.textContent = Math.round(progressPercentage) + '%';
          console.log('Progress percentage updated:', Math.round(progressPercentage) + '%');
        }

        // Cache for instant restore on next page load
        try { localStorage.setItem('cty_progress_' + new Date().toISOString().split('T')[0], progressPercentage.toString()); } catch(e) {}

        updateFace(progressPercentage);
        maybeCelebrate(progressPercentage);

      } else {
        console.log('User document not found, setting progress to 0%');
        try { localStorage.setItem('cty_progress_' + new Date().toISOString().split('T')[0], '0'); } catch(e) {}
        const progressBarFill = document.getElementById('progress-bar-fill');
        if (progressBarFill) {
          progressBarFill.style.width = '0%';
        }

        const progressPercentageElement = document.querySelector('.progress-percentage');
        if (progressPercentageElement) {
          progressPercentageElement.textContent = '0%';
        }

        updateFace(0);
      }
      
    } catch (error) {
      console.error('Error updating progress bar:', error);
      // Set progress to 0% on error
      const progressBarFill = document.getElementById('progress-bar-fill');
      if (progressBarFill) {
        progressBarFill.style.width = '0%';
      }
      
      const progressPercentageElement = document.querySelector('.progress-percentage');
      if (progressPercentageElement) {
        progressPercentageElement.textContent = '0%';
      }
    }
  }

  // Function to start progress bar refresh interval
  
  function startProgressBarRefresh() {
    // Update progress bar every 5 seconds
    const refreshInterval = setInterval(async () => {
      await updateProgressBar();
    }, 5000);
    
    // Store interval ID for cleanup
    window.progressBarRefreshInterval = refreshInterval;
    
    console.log('Progress bar refresh started - updating every 5 seconds');
  }

  // Function to stop progress bar refresh interval
  function stopProgressBarRefresh() {
    if (window.progressBarRefreshInterval) {
      clearInterval(window.progressBarRefreshInterval);
      window.progressBarRefreshInterval = null;
      console.log('Progress bar refresh stopped');
    }
  }

  // Function to manually update progress when tasks are completed
  // This can be called from other pages when tasks are completed
  window.updateDashboardProgress = async function() {
    await updateProgressBar();
    console.log('Dashboard progress manually updated');
  };

  // Function to fetch and display user data
  async function fetchAndDisplayUserData(user) {
    try {
      console.log('Fetching user data for:', user.uid);
      
      // Update date display immediately
      const dateElement = document.getElementById("verse-date");
      if (dateElement) {
        const today = new Date();
        const options = { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        };
        dateElement.textContent = today.toLocaleDateString('en-US', options);
        console.log('Date updated:', dateElement.textContent);
      } else {
        console.warn('Date element not found in DOM');
      }
      
      // Get user document from Firestore
      const userDoc = await db.collection("users").doc(user.uid).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log('User data fetched:', userData);
        
        // Personalize greeting with user's name
        const greetingElement = document.getElementById("greeting-text");
        if (greetingElement && userData.name) {
          const timeGreeting = getTimeBasedGreeting();
          greetingElement.textContent = `${timeGreeting}, ${userData.name}! 👋`;
        }
        
        // Display streak count
        const streakCount = userData.streakCount || 0;
        const streakElement = document.getElementById("streak-count");
        if (streakElement) {
          streakElement.textContent = `${streakCount} Day Streak!`;
          console.log('Streak count updated:', streakCount);
        } else {
          console.warn('Streak element not found in DOM');
        }

        // Set up a real-time listener
        const unsubscribe = firebase.firestore()
          .collection('users')
          .doc(user.uid) // Fixed: Use user.uid
          .onSnapshot((doc) => {
            if (doc.exists) {
              const userData = doc.data();
              const streakCount = userData.streakCount || 0;
              const streakElement = document.getElementById("streak-count");
              if (streakElement) {
                streakElement.textContent = `${streakCount} Day Streak!`;
                console.log('Streak count updated in real-time:', streakCount);
              }
            }
          });

        // Don't forget to unsubscribe when component/page is destroyed to prevent memory leaks
        // For example, add to window.addEventListener('beforeunload', unsubscribe);

        // Update progress bar
        await updateProgressBar();
        
        // Start progress bar refresh interval
        startProgressBarRefresh();
        
        showToast(`Welcome back, ${userData.name}!`, "success");
        
        // Removed: Duplicate content loading/rendering (let content.js handle it)
        // If you need something specific here, call a function from content.js
        
      } else {
        console.log('No user document found');
        showToast("User profile not found", "error");
      }
      
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Date still shows even if user data fails
    }
  }

  // Function to get group ID from user profile
  // window.getGroupIdFromProfile = function(userData) {
  //   if (userData.age) {
  //     if (userData.age >= 4 && userData.age <= 6) return "4-6";
  //     if (userData.age >= 7 && userData.age <= 10) return "7-10";
  //     if (userData.age >= 11 && userData.age <= 13) return "11-13";
  //     if (userData.age >= 14 && userData.age <= 17) return "14-17";
  //   }
  //   return "7-10"; // Default fallback
  // };

  // In dashboard.js - wait for content to load, then mutate it
  function waitForContentAndApplyPreviews() {
    // Wait for content to be rendered by content.js
    const checkInterval = setInterval(() => {
      const passageElement = document.getElementById('passage');
      const moralElement = document.getElementById('moral');
      
      if (passageElement && moralElement &&
          !passageElement.textContent.includes('Loading') &&
          !moralElement.textContent.includes('Loading')) {
        
        // Content is loaded, apply previews
        clearInterval(checkInterval);
        applyPreviews();
      }
    }, 100); // Check every 100ms
    
    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      console.warn('Timeout waiting for content to load');
    }, 5000);
  }


  // apply previews to passage and moral
 
    
 
   function applyPreviews() {
  //   // Get the full text
     const passageElement = document.getElementById('passage');
     const moralElement = document.getElementById('moral');
     
     if (passageElement) {
       const fullText = passageElement.textContent;
       const preview = fullText.split(' ').slice(0, 4).join(' ') + '...';
       passageElement.textContent = preview;
     }
     
   if (moralElement) {
     const fullText = moralElement.textContent;
     const preview = fullText.split(' ').slice(0, 4).join(' ') + '...';
     moralElement.textContent = preview;
   }
 }

  // DOMContentLoaded has already fired by the time Firebase is ready,
  // so call directly instead of listening for it.
  waitForContentAndApplyPreviews();

/**
 * Updates the user's daily streak in Firestore
 * @param {Object} user - Firebase user object (with .uid)
 */
  async function updateUserStreak(user) {
  if (!user || !user.uid) {
    console.warn("No user logged in.");
    return;
  }

  
  const userRef = db.collection("users").doc(user.uid);

  const today = new Date();
  const todayDateStr = today.toISOString().split("T")[0]; // "YYYY-MM-DD"

  // Guard: only run Firestore streak logic once per day per device
  const streakGuardKey = 'cty_streak_done_' + user.uid + '_' + todayDateStr;
  if (localStorage.getItem(streakGuardKey)) {
    console.log("Streak already updated today (localStorage guard). Skipping.");
    return;
  }

  try {
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      const userData = userSnap.data();
      const lastVisit = userData.lastVisit || null;
      const currentStreak = userData.streakCount || 0; // Now reads streakCount

      if (lastVisit === todayDateStr) {
        // Already visited today — skip to prevent inflation
        localStorage.setItem(streakGuardKey, '1');
        console.log("Already visited today. Streak unchanged.");
        return;
      }

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDateStr = yesterday.toISOString().split("T")[0];

      let newStreak;

      if (lastVisit === yesterdayDateStr) {
        // Consecutive day — increment streak
        newStreak = currentStreak + 1;
        console.log("Streak increased:", newStreak);
      } else if (lastVisit === null) {
        // First visit ever
        newStreak = 1;
        console.log("First visit! Streak started.");
      } else {
        // Missed a day — reset streak
        newStreak = 1;
        console.log("Streak broken. Reset to 1.");
      }

      // ✅ Now using 'streakCount' consistently when saving
      await userRef.set(
        {
          streakCount: newStreak,     // Fixed: was 'streak'
          lastVisit: todayDateStr,
        },
        { merge: true }
      );

      localStorage.setItem(streakGuardKey, '1');
      console.log(`Streak updated: ${newStreak} | Last visit: ${todayDateStr}`);
    } else {
      // New user — initialize with streakCount
      await userRef.set({
        streakCount: 1,
        lastVisit: todayDateStr,
      });

      localStorage.setItem(streakGuardKey, '1');
      console.log("New user streak initialized: 1");
    }
  } catch (error) {
    console.error("Error updating user streak:", error);
  }
}



// Check authentication state when page loads
  auth.onAuthStateChanged(async (user) => {
    
    if (user) {
      // User is signed in, allow access to dashboard
      console.log('User is authenticated:', user.email);
      
      // Fetch and display user data
      await fetchAndDisplayUserData(user);

      
    } else {
      // User is not signed in, redirect to login page
      console.log('No user authenticated, redirecting to login');
      window.location.href = '../authentication/login.html';
    }
    updateUserStreak(user); // Update streak on auth state change
  });

  // Add logout button functionality if it exists
  document.addEventListener("DOMContentLoaded", () => {
    // You can add logout button event listener here when you add the logout button
    console.log('Dashboard loaded successfully');
  });

  // Cleanup progress bar refresh when page is unloaded
  window.addEventListener('beforeunload', () => {
    stopProgressBarRefresh();
    console.log('Progress bar refresh stopped - page unloading');
  });

  // Cleanup progress bar refresh when page becomes hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopProgressBarRefresh();
      console.log('Progress bar refresh stopped - page hidden');
    } else {
      // Restart progress bar refresh when page becomes visible again
      if (auth.currentUser) {
        startProgressBarRefresh();
        console.log('Progress bar refresh restarted - page visible');
      }
    }
  });

  } // end runWhenFirebaseReady

  // ---- Instant progress bar restore from localStorage (runs before Firebase is ready) ----
  (function restoreProgressInstant() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cached = parseFloat(localStorage.getItem('cty_progress_' + today));
      if (isNaN(cached)) return;
      const fill = document.getElementById('progress-bar-fill');
      if (fill) fill.style.width = cached + '%';
      const pctEl = document.querySelector('.progress-percentage');
      if (pctEl) pctEl.textContent = Math.round(cached) + '%';
      const face = document.getElementById('progress-face');
      if (face) face.textContent = cached === 0 ? '😢' : cached < 50 ? '😐' : cached < 100 ? '😊' : '🥳';
    } catch(e) {}
  })();

  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
    runWhenFirebaseReady();
  } else {
    window.addEventListener('firebase-ready', runWhenFirebaseReady, { once: true });
  }
})();