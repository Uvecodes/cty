// Dashboard Logic - Firebase v8 Compatible
(function() {
  // Firebase Configuration (same as auth.js)
  // const firebaseConfig = {
  //   apiKey: "AIzaSyCRjTTx_FOCFybP5Dhp2Bz82NQN1n-9fJ4",
  //   authDomain: "catch-them-young-16da5.firebaseapp.com",
  //   projectId: "catch-them-young-16da5",
  //   storageBucket: "catch-them-young-16da5.firebasestorage.app",
  //   messagingSenderId: "777589364823",
  //   appId: "1:777589364823:web:ee9f214c01c7d9779aab12",
  //   measurementId: "G-H517ECEK72",
  // };

  // Initialize Firebase (only if not already initialized)
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
// 
  const auth = firebase.auth();
  const db = firebase.firestore();
// 
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
        
      } else {
        console.log('User document not found, setting progress to 0%');
        // Set progress to 0% if no user data
        const progressBarFill = document.getElementById('progress-bar-fill');
        if (progressBarFill) {
          progressBarFill.style.width = '0%';
        }
        
        const progressPercentageElement = document.querySelector('.progress-percentage');
        if (progressPercentageElement) {
          progressPercentageElement.textContent = '0%';
        }
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
    }, 500000);
    
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
        
        // Update progress bar
        await updateProgressBar();
        
        // Start progress bar refresh interval
        startProgressBarRefresh();
        
        showToast(`Welcome back, ${userData.name}!`, "success");
        
        // Load daily content after user data is fetched
        const groupId = window.getGroupIdFromProfile(userData);
        if (groupId) {
          try {
            // Load content for the user's age group using working functions
            const items = await loadGroupData(groupId);
            if (items && items.length > 0) {
              // Get user's timezone
              const tz = userData.tz || getUserTZ(userData);
              const todayISO = localDateInTZ(new Date(), tz);
              
              // Ensure group state exists
              const state = await ensureGroupState(user.uid, userData, groupId, items.length);
              if (state) {
                // Calculate today's content index
                const rawIndex = computeIndex(state, todayISO, items.length);
                const finalIndex = applyBlocklist(rawIndex, items, userData.blockedRefs || []);
                const item = items[finalIndex];
                
                if (item) {
                  // Update state after serving content
                  await persistServed(user.uid, groupId, todayISO, finalIndex);
                  
                  // Render daily card (for the commented section)
                  renderDailyCard(document.querySelector('#daily-card'), item, groupId);
                  
                  // Render dashboard content with previews
                  renderDashboardContent(item, groupId);
                }
              }
            }
          } catch (error) {
            console.error('Error loading daily content:', error);
            // Date still shows even if content fails
          }
        }
        
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
  window.getGroupIdFromProfile = function(userData) {
    if (userData.age) {
      if (userData.age >= 4 && userData.age <= 6) return "4-6";
      if (userData.age >= 7 && userData.age <= 10) return "7-10";
      if (userData.age >= 11 && userData.age <= 13) return "11-13";
      if (userData.age >= 14 && userData.age <= 17) return "14-17";
    }
    return "7-10"; // Default fallback
  };

  // Function to render daily card
  // function renderDailyCard(cardElement, item, groupId) {
    // if (!cardElement) return;
    // 
    // try {
      // Update date
      // const dateElement = cardElement.querySelector('#verse-date');
      // if (dateElement) {
        // const today = new Date();
        // const options = { 
          // weekday: 'long', 
          // year: 'numeric', 
          // month: 'long', 
          // day: 'numeric' 
        // };
        // dateElement.textContent = today.toLocaleDateString('en-US', options);
      // }
      // 
      // Update verse text
      // const verseElement = cardElement.querySelector('#daily-verse-text');
      // if (verseElement && item.verse_web) {
        // verseElement.textContent = item.verse_web;
      // }
      // 
      // Update verse reference
      // const refElement = cardElement.querySelector('#daily-verse-ref');
      // if (refElement && item.ref) {
        // refElement.textContent = item.ref;
      // }
      //
      // Update moral text
      // const moralElement = cardElement.querySelector('#daily-moral-text');
      // if (moralElement && item.moral) {
        // moralElement.textContent = item.moral;
      // }
      // 
      // Update challenge text
      // const challengeElement = cardElement.querySelector('#daily-challenge-text');
      // if (challengeElement && item.challenge) {
        // challengeElement.textContent = item.challenge;
      // }
      // 
      // console.log('Daily card rendered for group:', groupId);
      // 
    // } catch (error) {
      // console.error('Error rendering daily card:', error);
    // }
  // }

  
// text rendition with previews

  // In dashboard.js - wait for content to load, then mutate it
function waitForContentAndApplyPreviews() {
  // Wait for content to be rendered by content.js
  const checkInterval = setInterval(() => {
    const passageElement = document.getElementById('passage');
    const moralElement = document.getElementById('moral');
    
    if (passageElement && moralElement && 
        passageElement.textContent !== 'Loading...' && 
        moralElement.textContent !== 'Loading...') {
      
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

function applyPreviews() {
  // Get the full text
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

// Call this after dashboard loads
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for content.js to finish
  setTimeout(waitForContentAndApplyPreviews, 1000);
});

  
// 
  

  // Logout functionality
  // async function logout() {
  //   try {
  //     await auth.signOut();
  //     showToast("Logged out successfully!", "success");
  //     window.location.href = 'authentication/login.html';
  //   } catch (error) {
  //     console.error('Logout error:', error);
  //     showToast("Error during logout", "error");
  //   }
  // }


  

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

  try {
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      const userData = userSnap.data();
      const lastVisit = userData.lastVisit || null;
      const currentStreak = userData.streakCount || 0; // Now reads streakCount

      if (lastVisit === todayDateStr) {
        // Already visited today — skip to prevent inflation
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

      console.log(`Streak updated: ${newStreak} | Last visit: ${todayDateStr}`);
    } else {
      // New user — initialize with streakCount
      await userRef.set({
        streakCount: 1,
        lastVisit: todayDateStr,
      });

      console.log("New user streak initialized: 1");
    }
  } catch (error) {
    console.error("Error updating user streak:", error);
  }
  //Update streak count
        const streakElement = document.getElementById("streak-count");
        if (streakElement) {
          const streak = newStreak.streakCount || 0;
          streakElement.textContent = `${streak} Day Streak!`;
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
      window.location.href = 'authentication/login.html';
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

})(); 