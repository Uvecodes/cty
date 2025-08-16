// Dashboard Logic - Firebase v8 Compatible
(function() {
  // Firebase Configuration (same as auth.js)
  const firebaseConfig = {
    apiKey: "AIzaSyCRjTTx_FOCFybP5Dhp2Bz82NQN1n-9fJ4",
    authDomain: "catch-them-young-16da5.firebaseapp.com",
    projectId: "catch-them-young-16da5",
    storageBucket: "catch-them-young-16da5.firebasestorage.app",
    messagingSenderId: "777589364823",
    appId: "1:777589364823:web:ee9f214c01c7d9779aab12",
    measurementId: "G-H517ECEK72",
  };

  // Initialize Firebase (only if not already initialized)
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

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

  // Function to fetch and display user data
  async function fetchAndDisplayUserData(user) {
    try {
      console.log('Fetching user data for:', user.uid);
      
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
        
        // Update streak count
        const streakElement = document.getElementById("streak-count");
        if (streakElement) {
          const streak = userData.streak || 0;
          streakElement.textContent = `${streak} Day Streak!`;
        }
        
        showToast(`Welcome back, ${userData.name}!`, "success");
        
        // Load daily content after user data is fetched
        const groupId = window.getGroupIdFromProfile(userData);
        if (groupId) {
          try {
            const item = await ContentService.getToday(groupId);
            if (item) {
              renderDailyCard(document.querySelector('#daily-card'), item, groupId);
            }
          } catch (error) {
            console.error('Error loading daily content:', error);
          }
        }
        
      } else {
        console.log('No user document found');
        showToast("User profile not found", "error");
      }
      
    } catch (error) {
      console.error('Error fetching user data:', error);
      showToast("Error loading user data", "error");
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
  function renderDailyCard(cardElement, item, groupId) {
    if (!cardElement) return;
    
    try {
      // Update date
      const dateElement = cardElement.querySelector('#daily-date');
      if (dateElement) {
        const today = new Date();
        const options = { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        };
        dateElement.textContent = today.toLocaleDateString('en-US', options);
      }
      
      // Update verse text
      const verseElement = cardElement.querySelector('#daily-verse-text');
      if (verseElement && item.verse_web) {
        verseElement.textContent = item.verse_web;
      }
      
      // Update verse reference
      const refElement = cardElement.querySelector('#daily-verse-ref');
      if (refElement && item.ref) {
        refElement.textContent = item.ref;
      }
      
      // Update moral text
      const moralElement = cardElement.querySelector('#daily-moral-text');
      if (moralElement && item.moral) {
        moralElement.textContent = item.moral;
      }
      
      // Update challenge text
      const challengeElement = cardElement.querySelector('#daily-challenge-text');
      if (challengeElement && item.challenge) {
        challengeElement.textContent = item.challenge;
      }
      
      console.log('Daily card rendered for group:', groupId);
      
    } catch (error) {
      console.error('Error rendering daily card:', error);
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
  });

  // Logout functionality
  async function logout() {
    try {
      await auth.signOut();
      showToast("Logged out successfully!", "success");
      window.location.href = 'authentication/login.html';
    } catch (error) {
      console.error('Logout error:', error);
      showToast("Error during logout", "error");
    }
  }

  // Add logout button functionality if it exists
  document.addEventListener("DOMContentLoaded", () => {
    // You can add logout button event listener here when you add the logout button
    console.log('Dashboard loaded successfully');
  });

})(); 