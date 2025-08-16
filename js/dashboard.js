// Dashboard Authentication Protection
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// Content mapping for different age groups
const contentMap = {
  A: { 
    verse: "Be kind to one another – Ephesians 4:32", 
    moral: "Always share your toys and help others." 
  },
  B: { 
    verse: "I can do all things through Christ who strengthens me – Philippians 4:13", 
    moral: "Believe in yourself and trust in God's strength." 
  },
  C: { 
    verse: "Trust in the Lord with all your heart – Proverbs 3:5", 
    moral: "Make good choices and trust God to guide you." 
  },
  D: { 
    verse: "For I know the plans I have for you, declares the Lord – Jeremiah 29:11", 
    moral: "God has amazing plans for your future. Stay faithful!" 
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

// Parental control function
function applyParentalControls(userAge) {
  if (userAge < 10) {
    console.log('Applying parental controls for user under 10');
    
    // Show parental warning
    const parentalWarning = document.querySelector('#parental-warning');
    if (parentalWarning) {
      parentalWarning.innerText = "Parental Controls are active for your account.";
      parentalWarning.style.display = 'block';
    }
    
    // Hide/disable restricted features
    const restrictedElements = [
      { id: '#card-leaderboard', action: 'hide' },
      { id: '#edit-profile-btn', action: 'disable' },
      { id: '#dark-mode-toggle', action: 'disable' },
      { id: '#notif-settings-btn', action: 'disable' }
    ];
    
    restrictedElements.forEach(({ id, action }) => {
      const element = document.querySelector(id);
      if (element) {
        if (action === 'hide') {
          element.style.display = 'none';
        } else if (action === 'disable') {
          element.setAttribute('disabled', true);
          element.style.opacity = '0.5';
          element.style.cursor = 'not-allowed';
        }
        console.log(`Parental control applied to ${id}: ${action}`);
      }
    });
  }
}

// Dark mode functionality
function initDarkMode() {
  const darkModeToggle = document.querySelector('#dark-mode-toggle');
  const body = document.body;
  
  // Check localStorage for saved theme preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    body.classList.add('dark-mode');
  }
  
  // Add click event listener to toggle button
  darkModeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    
    // Save theme preference to localStorage
    const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    
    console.log('Theme switched to:', currentTheme);
  });
}

// Initialize dark mode on page load
initDarkMode();

// Check authentication state when page loads
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in, allow access to dashboard
    console.log('User is authenticated:', user.email);
    
    try {
      // Fetch user data from Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('User data fetched:', userData);
        
        // Apply parental controls based on age
        if (userData.age) {
          applyParentalControls(userData.age);
        }
        
        // Handle daily streak logic
        const today = new Date().toDateString();
        const lastLoginDate = userData.lastLoginDate || null;
        let currentStreak = userData.streakCount || 0;
        
        if (lastLoginDate) {
          const lastLogin = new Date(lastLoginDate);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          
          if (lastLogin.toDateString() === yesterday.toDateString()) {
            // User logged in yesterday, increment streak
            currentStreak += 1;
            console.log('Streak incremented to:', currentStreak);
          } else if (lastLogin.toDateString() === today) {
            // User already logged in today, keep current streak
            console.log('User already logged in today, streak unchanged:', currentStreak);
          } else {
            // More than one day has passed, reset streak
            currentStreak = 1;
            console.log('Streak reset to:', currentStreak);
          }
        } else {
          // First time login, start streak
          currentStreak = 1;
          console.log('First login, starting streak:', currentStreak);
        }
        
        // Update Firestore with new streak data
        await updateDoc(userDocRef, {
          lastLoginDate: today,
          streakCount: currentStreak
        });
        console.log('Streak data updated in Firestore');
        
        // Display user data in DOM elements
        const userNameElement = document.querySelector('#user-name');
        const userAgeElement = document.querySelector('#user-age');
        const userEmailElement = document.querySelector('#user-email');
        const userBirthdayElement = document.querySelector('#user-birthday');
        const userStreakElement = document.querySelector('#user-streak');
        
        if (userNameElement && userData.fullName) {
          userNameElement.textContent = userData.fullName;
        }
        
        if (userAgeElement && userData.age) {
          userAgeElement.textContent = userData.age;
        }
        
        if (userEmailElement && userData.email) {
          userEmailElement.textContent = userData.email;
        }
        
        if (userBirthdayElement && userData.birthday) {
          userBirthdayElement.textContent = userData.birthday;
        }
        
        // Display streak count
        if (userStreakElement) {
          userStreakElement.textContent = currentStreak;
        }
        
        // Update greeting with user's name
        const greetingElement = document.querySelector('.greeting h1');
        if (greetingElement && userData.fullName) {
          greetingElement.textContent = `Good Morning, ${userData.fullName}! 👋`;
        }
        
        // Update streak display in navbar if it exists
        const streakDisplayElement = document.querySelector('.streak-count');
        if (streakDisplayElement) {
          streakDisplayElement.textContent = currentStreak;
        }
        
        // Render Bible verse and moral based on age group
        if (userData.age) {
          const ageGroup = getAgeGroup(userData.age);
          const content = contentMap[ageGroup];
          
          if (content) {
            // Update verse card
            const verseCard = document.querySelector('.verse-card p');
            if (verseCard) {
              verseCard.textContent = content.verse;
            }
            
            // Update moral card
            const moralCard = document.querySelector('.moral-card p');
            if (moralCard) {
              moralCard.textContent = content.moral;
            }
            
            console.log(`Content rendered for age group ${ageGroup}:`, content);
          }
        }
        
      } else {
        console.log('No user document found in Firestore');
      }
      
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
    
  } else {
    // User is not signed in, redirect to login page
    console.log('No user authenticated, redirecting to login');
    window.location.href = 'login.html';
  }
});

// Logout functionality
const logoutBtn = document.querySelector('#logout-btn');

logoutBtn.addEventListener('click', async () => {
  try {
    // Sign out the user
    await signOut(auth);
    console.log('User signed out successfully');
    
    // Redirect to login page
    window.location.href = 'login.html';
    
  } catch (error) {
    console.error('Logout error:', error);
    alert('An error occurred during logout. Please try again.');
  }
}); 