const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { verifyToken } = require('../middleware/auth');
const { versesLimiter } = require('../middleware/rateLimits');
const { auth, db, admin } = require('../config/firebase-admin');
const {
  getUserTZ,
  localDateInTZ,
  daysBetween,
  stableHash,
  derivedAge,
  ageToGroupKey,
  computeIndex,
  applyBlocklist
} = require('../utils/verse-helpers');

const router = express.Router();

/**
 * GET /api/verses/today
 * Get today's verse for authenticated user
 * Implements the same deterministic logic as frontend
 */
router.get('/today', versesLimiter, verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    
    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User document does not exist'
      });
    }
    
    const userData = userDoc.data();
    
    // Get or set user timezone
    let tz = getUserTZ(userData);
    if (!userData.tz) {
      // Set timezone if not set
      await db.collection('users').doc(uid).set({ tz }, { merge: true });
      userData.tz = tz;
    }
    
    // Calculate today's date in user's timezone
    const todayISO = localDateInTZ(new Date(), tz);
    
    // Calculate current age using 4-strategy approach
    const age = derivedAge(userData, tz);
    
    // Determine age group
    const groupKey = ageToGroupKey(age);
    if (!groupKey) {
      return res.status(400).json({
        error: 'Invalid age',
        message: `Age ${age} is outside valid range (4-17)`
      });
    }
    
    // Load JSON file for the age group
    const jsonPath = path.join(__dirname, '..', 'data', `content-${groupKey}.json`);
    let items;
    try {
      const jsonData = await fs.readFile(jsonPath, 'utf8');
      items = JSON.parse(jsonData);
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(500).json({
          error: 'Invalid verse data',
          message: `No verses found for age group ${groupKey}`
        });
      }
    } catch (error) {
      console.error(`Error loading JSON file for group ${groupKey}:`, error);
      return res.status(500).json({
        error: 'Failed to load verses',
        message: `Could not load verse data for age group ${groupKey}`
      });
    }
    
    const N = items.length;
    
    // Get or initialize contentState[groupKey]
    let state = userData.contentState && userData.contentState[groupKey] 
      ? userData.contentState[groupKey] 
      : null;
    
    // Initialize state if it doesn't exist
    if (!state || state.startIndex === undefined || !state.startDate) {
      const newState = {
        startIndex: stableHash(uid + ":" + groupKey) % N,
        startDate: todayISO,
        lastServedDate: "",
        lastServedIndex: -1
      };
      
      // Use transaction to atomically create state
      const userRef = db.collection('users').doc(uid);
      try {
        const resultState = await db.runTransaction(async (tx) => {
          const snap = await tx.get(userRef);
          const serverData = snap.exists ? snap.data() : {};
          const serverState = serverData && serverData.contentState 
            ? serverData.contentState[groupKey] 
            : undefined;

          // If server already has a valid state for this group, return it (no overwrite)
          if (serverState && serverState.startIndex !== undefined && serverState.startDate) {
            return serverState;
          }

          // Otherwise write our new state
          tx.set(userRef, { 
            contentState: { [groupKey]: newState } 
          }, { merge: true });

          return newState;
        });
        
        state = resultState;
        console.log(`Initialized content state for user ${uid} group ${groupKey}`);
      } catch (txError) {
        console.error(`Transaction failed while initializing content state for ${uid} group ${groupKey}:`, txError);
        // Use local state as fallback
        state = newState;
      }
    }
    
    // Check if already served today
    if (state.lastServedDate === todayISO && state.lastServedIndex >= 0) {
      const selectedItem = items[state.lastServedIndex];
      if (selectedItem) {
        console.log(`Returning already served verse for user ${uid} on ${todayISO}`);
        return res.json({
          success: true,
          verse: selectedItem,
          index: state.lastServedIndex,
          totalVerses: N,
          groupKey: groupKey
        });
      }
    }
    
    // Calculate verse index
    const rawIndex = computeIndex(state, todayISO, N);
    
    // Apply blocklist if present
    let finalIndex = rawIndex;
    if (userData.blockedRefs && Array.isArray(userData.blockedRefs) && userData.blockedRefs.length > 0) {
      finalIndex = applyBlocklist(rawIndex, items, userData.blockedRefs);
      if (finalIndex !== rawIndex) {
        console.log(`Index adjusted from ${rawIndex} to ${finalIndex} due to blocklist for user ${uid}`);
      }
    }
    
    // Persist served content to Firestore
    try {
      await db.collection('users').doc(uid).set({
        [`contentState.${groupKey}.lastServedDate`]: todayISO,
        [`contentState.${groupKey}.lastServedIndex`]: finalIndex
      }, { merge: true });
      
      console.log(`Persisted served content for user ${uid} group ${groupKey}: date=${todayISO}, index=${finalIndex}`);
    } catch (error) {
      console.error(`Failed to persist served content to Firestore for user ${uid} group ${groupKey}:`, error);
      // Continue anyway to return verse
    }
    
    // Get the selected verse
    const selectedItem = items[finalIndex];
    if (!selectedItem) {
      return res.status(500).json({
        error: 'Verse not found',
        message: `No verse found at index ${finalIndex}`
      });
    }
    
    console.log(`Returning verse for user ${uid} on ${todayISO}: index=${finalIndex}, group=${groupKey}`);
    
    res.json({
      success: true,
      verse: selectedItem,
      index: finalIndex,
      totalVerses: N,
      groupKey: groupKey
    });
    
  } catch (error) {
    console.error('Error in /api/verses/today:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while fetching today\'s verse'
    });
  }
});

module.exports = router;
