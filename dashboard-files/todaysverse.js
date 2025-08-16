// Today's Verse Page Logic - Firebase v8 Compatible
(function() {
  // Firebase Configuration (same as auth.js and dashboard.js)
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

  // Toast notification function
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

  // Content mapping for different age groups
  const contentMap = {
    A: { 
      verse: "Be kind to one another – Ephesians 4:32", 
      moral: "Always share your toys and help others. When you're kind, it makes everyone happy, including you!",
      reference: "Ephesians 4:32"
    },
    B: { 
      verse: "I can do all things through Christ who strengthens me – Philippians 4:13", 
      moral: "Believe in yourself and trust in God's strength. You are capable of amazing things!",
      reference: "Philippians 4:13"
    },
    C: { 
      verse: "Trust in the Lord with all your heart – Proverbs 3:5", 
      moral: "Make good choices and trust God to guide you. He knows what's best for your life.",
      reference: "Proverbs 3:5"
    },
    D: { 
      verse: "For I know the plans I have for you, declares the Lord – Jeremiah 29:11", 
      moral: "God has amazing plans for your future. Stay faithful and trust in His perfect timing!",
      reference: "Jeremiah 29:11"
    }
  };

  // Function to determine age group
  function getAgeGroup(age) {
    if (age >= 4 && age <= 6) return 'A';
    if (age >= 7 && age <= 10) return 'B';
    if (age >= 11 && age <= 13) return 'C';
    if (age >= 14 && age <= 17) return 'D';
    return 'B'; // Default fallback
  }

  // Function to get today's date
  function getTodayDate() {
    const today = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return today.toLocaleDateString('en-US', options);
  }

  // Function to display verse content
  function displayVerseContent(userData) {
    try {
      // Update date
      const dateElement = document.getElementById("verse-date");
      if (dateElement) {
        dateElement.textContent = getTodayDate();
      }

      // Get age-appropriate content
      if (userData.age) {
        const ageGroup = getAgeGroup(userData.age);
        const content = contentMap[ageGroup];
        
        if (content) {
          // Update verse text
          const verseElement = document.getElementById("verse-text");
          if (verseElement) {
            verseElement.textContent = content.verse;
          }

          // Update verse reference
          const referenceElement = document.getElementById("verse-reference");
          if (referenceElement) {
            referenceElement.textContent = content.reference;
          }

          // Update moral text
          const moralElement = document.getElementById("moral-text");
          if (moralElement) {
            moralElement.textContent = content.moral;
          }

          console.log(`Content displayed for age group ${ageGroup}:`, content);
        }
      } else {
        // Default content if no age data
        const defaultContent = contentMap['B'];
        document.getElementById("verse-text").textContent = defaultContent.verse;
        document.getElementById("verse-reference").textContent = defaultContent.reference;
        document.getElementById("moral-text").textContent = defaultContent.moral;
      }
      
    } catch (error) {
      console.error('Error displaying verse content:', error);
      showToast("Error loading verse content", "error");
    }
  }

  // Function to handle mark as complete
  async function markAsComplete(userId) {
    try {
      const today = new Date().toDateString();
      
      // Update user's completion status in Firestore
      await db.collection("users").doc(userId).update({
        lastVerseCompleted: today,
        verseCompletionCount: firebase.firestore.FieldValue.increment(1)
      });

      showToast("Great job! Verse marked as complete! 🎉", "success");
      
      // Update button state
      const completeBtn = document.getElementById("mark-complete");
      if (completeBtn) {
        completeBtn.textContent = "✅ Completed!";
        completeBtn.disabled = true;
        completeBtn.style.opacity = "0.7";
      }

    } catch (error) {
      console.error('Error marking verse as complete:', error);
      showToast("Error updating completion status", "error");
    }
  }

  // Function to handle share verse
  function shareVerse() {
    const verseText = document.getElementById("verse-text").textContent;
    const moralText = document.getElementById("moral-text").textContent;
    
    const shareText = `Today's Bible Verse: ${verseText}\n\nMoral: ${moralText}\n\nShared from Catch Them Young App! 📖✨`;
    
    if (navigator.share) {
      navigator.share({
        title: "Today's Bible Verse",
        text: shareText,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText).then(() => {
        showToast("Verse copied to clipboard! 📋", "success");
      }).catch(() => {
        showToast("Unable to copy verse", "error");
      });
    }
  }

  // Function to handle save verse
  async function saveVerse(userId) {
    try {
      const verseData = {
        verse: document.getElementById("verse-text").textContent,
        moral: document.getElementById("moral-text").textContent,
        reference: document.getElementById("verse-reference").textContent,
        savedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Save to user's saved verses collection
      await db.collection("users").doc(userId).collection("savedVerses").add(verseData);

      showToast("Verse saved for later! 💾", "success");
      
      // Update button state
      const saveBtn = document.getElementById("save-verse");
      if (saveBtn) {
        saveBtn.textContent = "💾 Saved!";
        saveBtn.disabled = true;
        saveBtn.style.opacity = "0.7";
      }

    } catch (error) {
      console.error('Error saving verse:', error);
      showToast("Error saving verse", "error");
    }
  }

  // Check authentication state when page loads
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // User is signed in, allow access to verse page
      console.log('User is authenticated:', user.email);
      
      try {
        // Fetch user data from Firestore
        const userDoc = await db.collection("users").doc(user.uid).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          console.log('User data fetched:', userData);
          
          // Display verse content based on user's age
          displayVerseContent(userData);
          
          // Check if verse was already completed today
          if (userData.lastVerseCompleted === new Date().toDateString()) {
            const completeBtn = document.getElementById("mark-complete");
            if (completeBtn) {
              completeBtn.textContent = "✅ Completed!";
              completeBtn.disabled = true;
              completeBtn.style.opacity = "0.7";
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
      
    } else {
      // User is not signed in, redirect to login page
      console.log('No user authenticated, redirecting to login');
      window.location.href = './authentication/login.html';
    }
  });

  // Add event listeners when page loads
  document.addEventListener("DOMContentLoaded", () => {
    // Mark as complete button
    const completeBtn = document.getElementById("mark-complete");
    if (completeBtn) {
      completeBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (user) {
          await markAsComplete(user.uid);
        }
      });
    }

    // Share verse button
    const shareBtn = document.getElementById("share-verse");
    if (shareBtn) {
      shareBtn.addEventListener("click", shareVerse);
    }

    // Save verse button
    const saveBtn = document.getElementById("save-verse");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (user) {
          await saveVerse(user.uid);
        }
      });
    }

    console.log('Today\'s Verse page loaded successfully');
  });

})();
