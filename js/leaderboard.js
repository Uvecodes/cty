// Leaderboard Functionality
import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

// Render leaderboard function
async function renderLeaderboard() {
  try {
    // Query users collection by streakCount in descending order, limit to top 10
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("streakCount", "desc"), limit(10));
    const querySnapshot = await getDocs(q);
    
    const leaderboardList = document.querySelector('#leaderboard-list');
    
    if (!leaderboardList) {
      console.error('Leaderboard list container not found');
      return;
    }
    
    // Clear existing content
    leaderboardList.innerHTML = '';
    
    let rank = 1;
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      const fullName = userData.fullName || 'Anonymous User';
      const streakCount = userData.streakCount || 0;
      
      // Create leaderboard entry
      const entry = document.createElement('div');
      entry.className = 'leaderboard-entry';
      entry.innerHTML = `
        <span class="rank">${rank}</span>
        <span class="user-name">${fullName}</span>
        <span class="streak">🔥 ${streakCount}</span>
      `;
      
      leaderboardList.appendChild(entry);
      rank++;
    });
    
    console.log('Leaderboard rendered successfully');
    
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
  }
}

// Initialize leaderboard on page load
renderLeaderboard(); 