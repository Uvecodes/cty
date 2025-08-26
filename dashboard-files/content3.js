// Note: Do NOT hardcode Firebase configuration in production.
// Instead, initialize Firebase in a secure backend or use environment variables.
// Example placeholder for Firebase config (replace with secure initialization):

// import firebase from 'firebase/app';
// import 'firebase/firestore';
// import 'firebase/auth';

 const firebaseConfig = {
    apiKey: "AIzaSyCRjTTx_FOCFybP5Dhp2Bz82NQN1n-9fJ4",
    authDomain: "catch-them-young-16da5.firebaseapp.com",
    projectId: "catch-them-young-16da5",
    storageBucket: "catch-them-young-16da5.firebasestorage.app",
    messagingSenderId: "777589364823",
    appId: "1:777589364823:web:ee9f214c01c7d9779aab12",
    measurementId: "G-H517ECEK72",
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


// Import date-fns for accurate date handling
import { differenceInDays, isValid, addDays, isLeapYear } from 'date-fns';

// Constants for maintainability
const GROUP_PATHS = {
  '4-6': '/data/content-4-6.json',
  '7-10': '/data/content-7-10.json',
  '11-13': '/data/content-11-13.json',
  '14-17': '/data/content-14-17.json'
};

const DEFAULT_TIMEZONE = 'UTC';
const MIGRATION_REPROMPT_DAYS = 7;
const HASH_SEED = 5381;
const DOM_ELEMENT_IDS = ['ref', 'passage', 'moral', 'reflectionQ', 'challenge'];

// Cache for group data to improve performance
const groupDataCache = new Map();

/**
 * Gets the user's timezone with robust fallback
 * @param {Object} userDoc - User document from Firestore
 * @returns {string} Timezone string
 */
function getUserTZ(userDoc) {
  if (userDoc?.tz) {
    return userDoc.tz;
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) throw new Error('Timezone resolution failed');
    return tz;
  } catch (error) {
    console.warn('getUserTZ: Failed to resolve timezone, falling back to UTC', error);
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Formats a date in the specified timezone
 * @param {Date|string} date - Date to format
 * @param {string} tz - Timezone
 * @returns {string} Formatted date (YYYY-MM-DD)
 */
function localDateInTZ(date, tz) {
  const dateObj = new Date(date);
  if (!isValid(dateObj)) {
    console.warn('localDateInTZ: Invalid date provided', date);
    return new Date().toISOString().split('T')[0]; // Fallback to today
  }

  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateObj);
  } catch (error) {
    console.warn(`localDateInTZ: Failed to format date for timezone ${tz}`, error);
    return dateObj.toISOString().split('T')[0]; // Fallback to ISO date
  }
}

/**
 * Calculates days between two dates, handling edge cases
 * @param {string} dateA - ISO date string
 * @param {string} dateB - ISO date string
 * @returns {number} Days between dates
 */
function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);

  if (!isValid(a) || !isValid(b)) {
    console.warn('daysBetween: Invalid date(s)', { dateA, dateB });
    return 0;
  }

  if (b < a) {
    console.warn('daysBetween: dateB is before dateA', { dateA, dateB });
    return 0;
  }

  return differenceInDays(b, a);
}

/**
 * Generates a stable hash for deterministic indexing
 * @param {string} str - Input string
 * @returns {number} Hash value
 */
function stableHash(str) {
  if (typeof str !== 'string') {
    console.warn('stableHash: Input must be a string', str);
    return 0;
  }

  let h = HASH_SEED;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
  }
  return h >>> 0;
}

/**
 * Counts anniversaries between dates, handling leap years
 * @param {string} startISO - Start date
 * @param {string} endISO - End date
 * @param {number} month - Birth month (1-12)
 * @param {number} day - Birth day
 * @param {string} tz - Timezone
 * @returns {number} Number of anniversaries
 */
function countAnniversaries(startISO, endISO, month, day, tz) {
  const start = new Date(startISO);
  const end = new Date(endISO);

  if (!isValid(start) || !isValid(end) || end < start) {
    console.warn('countAnniversaries: Invalid date range', { startISO, endISO });
    return 0;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    console.warn('countAnniversaries: Invalid month or day', { month, day });
    return 0;
  }

  // Handle leap day rule
  let targetMonth = month;
  let targetDay = day;
  if (month === 2 && day === 29) {
    targetMonth = 2;
    targetDay = 28;
  }

  let count = 0;
  const startDateInTZ = localDateInTZ(start, tz);
  const [startYear, startMonth, startDay] = startDateInTZ.split('-').map(Number);
  const endDateInTZ = localDateInTZ(end, tz);
  const endYear = parseInt(endDateInTZ.split('-')[0]);

  let firstYear = startYear;
  if (startMonth > targetMonth || (startMonth === targetMonth && startDay > targetDay)) {
    firstYear = startYear + 1;
  }

  for (let year = firstYear; year <= endYear; year++) {
    // Adjust for leap years if target is Feb 29
    let adjustedDay = targetDay;
    if (month === 2 && day === 29 && !isLeapYear(new Date(year, 0, 1))) {
      adjustedDay = 28;
    }

    const targetDate = new Date(year, targetMonth - 1, adjustedDay);
    const targetDateInTZ = localDateInTZ(targetDate, tz);

    if (targetDateInTZ >= startDateInTZ && targetDateInTZ <= endDateInTZ) {
      count++;
    }
  }

  return Math.max(0, count);
}

/**
 * Derives user age using multiple strategies
 * @param {Object} userDoc - User document
 * @param {string} tz - Timezone
 * @returns {number} Calculated age
 */
function derivedAge(userDoc, tz) {
  if (!userDoc) {
    console.warn('derivedAge: No user document provided');
    return 0;
  }

  const todayISO = localDateInTZ(new Date(), tz);

  // Strategy 1: Exact age from DOB
  if (userDoc.dob) {
    const dob = new Date(userDoc.dob);
    if (!isValid(dob)) {
      console.warn('derivedAge: Invalid DOB', userDoc.dob);
      return 0;
    }
    return Math.floor(differenceInDays(new Date(todayISO), dob) / 365.25);
  }

  // Strategy 2: Birth month/day + ageAtSet + ageSetAt
  if (userDoc.birthMonth && userDoc.birthDay && userDoc.ageAtSet && userDoc.ageSetAt) {
    const anniversaries = countAnniversaries(userDoc.ageSetAt, todayISO, userDoc.birthMonth, userDoc.birthDay, tz);
    return userDoc.ageAtSet + anniversaries;
  }

  // Strategy 3: Crude fallback using age + ageSetAt
  if (userDoc.age && userDoc.ageSetAt) {
    const daysDiff = daysBetween(userDoc.ageSetAt, todayISO);
    const yearsDiff = Math.floor(daysDiff / 365.25);
    return userDoc.age + yearsDiff;
  }

  // Strategy 4: Fallback to age field
  return Number(userDoc.age || 0);
}

/**
 * Maps age to group key
 * @param {number} age - User's age
 * @returns {string|null} Group key
 */
function ageToGroupKey(age) {
  if (!Number.isInteger(age) || age < 0) {
    console.warn('ageToGroupKey: Invalid age', age);
    return null;
  }

  if (age >= 4 && age <= 6) return '4-6';
  if (age >= 7 && age <= 10) return '7-10';
  if (age >= 11 && age <= 13) return '11-13';
  if (age >= 14 && age <= 17) return '14-17';
  return null;
}

/**
 * Ensures the user's active group is set
 * @param {string} uid - User ID
 * @param {Object} userDoc - User document
 * @param {string} tz - Timezone
 * @param {Function} initializer - Optional initializer
 * @returns {Promise<string|null>} Group key
 */
async function ensureActiveGroup(uid, userDoc, tz, initializer) {
  if (!uid || !userDoc || !tz) {
    console.warn('ensureActiveGroup: Missing parameters', { uid, hasUserDoc: !!userDoc, tz });
    return null;
  }

  const currentAge = derivedAge(userDoc, tz);
  const currentKey = ageToGroupKey(currentAge);

  if (!currentKey) {
    console.warn(`ensureActiveGroup: Invalid age for user ${uid}: ${currentAge}`);
    return null;
  }

  if (userDoc.activeGroup === currentKey) {
    return currentKey;
  }

  const oldGroup = userDoc.activeGroup || 'none';
  console.log(`ensureActiveGroup: Group change for user ${uid}: ${oldGroup} → ${currentKey} (age: ${currentAge})`);

  try {
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(uid);
      transaction.set(userRef, { activeGroup: currentKey }, { merge: true });
    });
    console.log(`ensureActiveGroup: Updated active group for user ${uid}: ${currentKey}`);
  } catch (error) {
    console.error(`ensureActiveGroup: Failed to update group for user ${uid}`, error);
    return null;
  }

  if (initializer && (!userDoc.contentState || !userDoc.contentState[currentKey])) {
    try {
      await initializer(currentKey);
    } catch (error) {
      console.warn(`ensureActiveGroup: Failed to initialize content state for group ${currentKey}, user ${uid}`, error);
    }
  }

  return currentKey;
}

/**
 * Loads group data with caching
 * @param {string} groupKey - Group key
 * @returns {Promise<Array>} Group data
 */
async function loadGroupData(groupKey) {
  if (!GROUP_PATHS[groupKey]) {
    console.warn('loadGroupData: Invalid group key', groupKey);
    return [];
  }

  if (groupDataCache.has(groupKey)) {
    console.log(`loadGroupData: Cache hit for group ${groupKey}`);
    return groupDataCache.get(groupKey);
  }

  try {
    const response = await fetch(GROUP_PATHS[groupKey], { cache: 'no-store' });
    if (!response.ok) {
      console.warn(`loadGroupData: Failed to fetch data for group ${groupKey}`, response.status);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      console.warn(`loadGroupData: Invalid data format for group ${groupKey}`, typeof data);
      return [];
    }

    groupDataCache.set(groupKey, data);
    return data;
  } catch (error) {
    console.error(`loadGroupData: Error loading data for group ${groupKey}`, error);
    return [];
  }
}

/**
 * Ensures group state is initialized
 * @param {string} uid - User ID
 * @param {Object} userDoc - User document
 * @param {string} groupKey - Group key
 * @param {number} N - Number of items
 * @returns {Promise<Object|null>} Group state
 */
async function ensureGroupState(uid, userDoc, groupKey, N) {
  if (!uid || !userDoc || !groupKey || !Number.isInteger(N) || N <= 0) {
    console.warn('ensureGroupState: Invalid parameters', { uid, hasUserDoc: !!userDoc, groupKey, N });
    return null;
  }

  if (
    userDoc.contentState?.[groupKey]?.startIndex !== undefined &&
    userDoc.contentState[groupKey].startDate
  ) {
    return userDoc.contentState[groupKey];
  }

  const tz = getUserTZ(userDoc);
  const startIndex = stableHash(`${uid}:${groupKey}`) % N;
  const startDate = localDateInTZ(new Date(), tz);
  const newState = {
    startIndex,
    startDate,
    lastServedDate: '',
    lastServedIndex: -1
  };

  try {
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(uid);
      transaction.set(userRef, { [`contentState.${groupKey}`]: newState }, { merge: true });
    });
    console.log(`ensureGroupState: Initialized state for user ${uid}, group ${groupKey}`, newState);
    return newState;
  } catch (error) {
    console.error(`ensureGroupState: Failed to initialize state for user ${uid}, group ${groupKey}`, error);
    return null;
  }
}

/**
 * Computes the content index for today
 * @param {Object} state - Group state
 * @param {string} todayISO - Today's date
 * @param {number} N - Number of items
 * @returns {number} Content index
 */
function computeIndex(state, todayISO, N) {
  if (!state || state.startIndex === undefined || !state.startDate || !todayISO || !Number.isInteger(N) || N <= 0) {
    console.warn('computeIndex: Invalid parameters', { state, todayISO, N });
    return 0;
  }

  if (state.lastServedDate === todayISO && state.lastServedIndex >= 0) {
    return state.lastServedIndex;
  }

  const dayNumber = Math.max(0, daysBetween(state.startDate, todayISO));
  return (state.startIndex + dayNumber) % N;
}

/**
 * Applies blocklist to skip blocked content
 * @param {number} index - Starting index
 * @param {Array} items - Content items
 * @param {Array} blockedRefs - Blocked references
 * @returns {number} Adjusted index
 */
function applyBlocklist(index, items, blockedRefs) {
  if (!items?.length || !blockedRefs?.length || index < 0 || index >= items.length) {
    return index;
  }

  let currentIndex = index;
  const maxIterations = items.length; // Prevent infinite loops
  let iterations = 0;

  while (iterations < maxIterations) {
    const currentItem = items[currentIndex];
    if (!currentItem || !blockedRefs.includes(currentItem.ref)) {
      return currentIndex;
    }
    console.log(`applyBlocklist: Skipping blocked content at index ${currentIndex} (ref: ${currentItem.ref})`);
    currentIndex = (currentIndex + 1) % items.length;
    iterations++;
  }

  console.warn('applyBlocklist: All items blocked or invalid, returning original index', index);
  return index;
}

/**
 * Persists served content to Firestore and localStorage
 * @param {string} uid - User ID
 * @param {string} groupKey - Group key
 * @param {string} todayISO - Today's date
 * @param {number} index - Content index
 * @returns {Promise<boolean>} Success status
 */
async function persistServed(uid, groupKey, todayISO, index) {
  if (!uid || !groupKey || !todayISO || !Number.isInteger(index)) {
    console.warn('persistServed: Invalid parameters', { uid, groupKey, todayISO, index });
    return false;
  }

  try {
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(uid);
      transaction.set(userRef, {
        [`contentState.${groupKey}.lastServedDate`]: todayISO,
        [`contentState.${groupKey}.lastServedIndex`]: index
      }, { merge: true });
    });
    console.log(`persistServed: Persisted content for user ${uid}, group ${groupKey}: date=${todayISO}, index=${index}`);
  } catch (error) {
    console.error(`persistServed: Failed to persist to Firestore for user ${uid}, group ${groupKey}`, error);
    return false;
  }

  try {
    const localStorageKey = `cty_${groupKey}_${todayISO}`;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(localStorageKey, String(index));
      console.log(`persistServed: Stored in localStorage: ${localStorageKey} = ${index}`);
    }
  } catch (error) {
    console.warn(`persistServed: Failed to store in localStorage for user ${uid}, group ${groupKey}`, error);
  }

  return true;
}

/**
 * Renders content item to DOM
 * @param {Object} item - Content item
 */
function renderItemToDOM(item) {
  if (!item) {
    console.warn('renderItemToDOM: No item provided');
    return;
  }

  const fragment = document.createDocumentFragment();
  let allElementsFound = true;

  DOM_ELEMENT_IDS.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`renderItemToDOM: Element not found: ${id}`);
      allElementsFound = false;
      return;
    }
    const content = item[id] || '';
    const textNode = document.createTextNode(content);
    fragment.appendChild(textNode.cloneNode(true));
    element.textContent = content;
  });

  if (!allElementsFound) {
    console.warn('renderItemToDOM: Some DOM elements missing, rendering may be incomplete');
  }
}

/**
 * Determines if migration prompt should be shown
 * @param {Object} userDoc - User document
 * @param {string} todayISO - Today's date
 * @returns {boolean} Whether to show migration
 */
function shouldShowMigration(userDoc, todayISO) {
  if (!userDoc || !todayISO) {
    console.warn('shouldShowMigration: Missing parameters', { hasUserDoc: !!userDoc, todayISO });
    return false;
  }

  const hasBirthInfo = userDoc.birthMonth && userDoc.birthDay;
  if (hasBirthInfo) {
    return false;
  }

  if (!userDoc.migrationSkipUntil) {
    return true;
  }

  return todayISO >= userDoc.migrationSkipUntil;
}

/**
 * Schedules a migration re-prompt
 * @param {string} uid - User ID
 * @param {string} todayISO - Today's date
 * @param {number} days - Days to skip
 * @returns {Promise<boolean>} Success status
 */
async function scheduleRePrompt(uid, todayISO, days = MIGRATION_REPROMPT_DAYS) {
  if (!uid || !todayISO || !Number.isInteger(days) || days <= 0) {
    console.warn('scheduleRePrompt: Invalid parameters', { uid, todayISO, days });
    return false;
  }

  try {
    const today = new Date(todayISO);
    if (!isValid(today)) {
      console.warn('scheduleRePrompt: Invalid todayISO', todayISO);
      return false;
    }

    const skipUntil = addDays(today, days);
    const skipUntilFormatted = localDateInTZ(skipUntil, DEFAULT_TIMEZONE);

    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(uid);
      transaction.set(userRef, { migrationSkipUntil: skipUntilFormatted }, { merge: true });
    });

    console.log(`scheduleRePrompt: Scheduled re-prompt for user ${uid} until ${skipUntilFormatted}`);
    return true;
  } catch (error) {
    console.error(`scheduleRePrompt: Failed for user ${uid}`, error);
    return false;
  }
}

/**
 * Placeholder for migration modal (replace with actual UI logic)
 * @param {Function} onSave - Save callback
 * @param {Function} onSkip - Skip callback
 */
function openMigrationModal(onSave, onSkip) {
  if (!onSave || !onSkip) {
    console.warn('openMigrationModal: Missing callbacks');
    return;
  }

  // TODO: Implement actual modal UI logic
  console.log('openMigrationModal: Placeholder invoked, replace with UI logic');
  // Simulate user input for testing (remove in production)
  const testMonth = 6;
  const testDay = 15;
  console.log(`openMigrationModal: Simulating save with month=${testMonth}, day=${testDay}`);
  onSave(testMonth, testDay);
}

/**
 * Submits migration data
 * @param {string} uid - User ID
 * @param {Object} userDoc - User document
 * @param {number} month - Birth month
 * @param {number} day - Birth day
 * @param {string} tz - Timezone
 * @returns {Promise<Object|null>} Updated user document
 */
async function submitMigration(uid, userDoc, month, day, tz) {
  if (!uid || !userDoc || !Number.isInteger(month) || !Number.isInteger(day) || !tz) {
    console.warn('submitMigration: Invalid parameters', { uid, hasUserDoc: !!userDoc, month, day, tz });
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    console.warn('submitMigration: Invalid month or day', { month, day });
    return null;
  }

  try {
    const todayISO = localDateInTZ(new Date(), tz);
    const currentAge = Number(userDoc.age || derivedAge(userDoc, tz));

    const migrationData = {
      birthMonth: month,
      birthDay: day,
      ageAtSet: currentAge,
      ageSetAt: todayISO
    };

    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(uid);
      transaction.set(userRef, migrationData, { merge: true });
    });

    console.log(`submitMigration: Completed for user ${uid}`, migrationData);
    return { ...userDoc, ...migrationData };
  } catch (error) {
    console.error(`submitMigration: Failed for user ${uid}`, error);
    return null;
  }
}

/**
 * Renders today's content for the authenticated user
 * @returns {Promise<void>}
 */
async function renderTodayContent() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      console.log('renderTodayContent: No authenticated user');
      return;
    }

    const uid = user.uid;
    console.log(`renderTodayContent: Starting for user ${uid}`);

    let userDoc;
    try {
      const userSnapshot = await db.collection('users').doc(uid).get();
      if (!userSnapshot.exists) {
        console.warn(`renderTodayContent: User document not found for ${uid}`);
        return;
      }
      userDoc = userSnapshot.data();
    } catch (error) {
      console.error(`renderTodayContent: Failed to read user document for ${uid}`, error);
      return;
    }

    let tz = userDoc.tz || getUserTZ(userDoc);
    if (!userDoc.tz) {
      try {
        await db.collection('users').doc(uid).set({ tz }, { merge: true });
        userDoc.tz = tz;
        console.log(`renderTodayContent: Updated timezone for user ${uid}: ${tz}`);
      } catch (error) {
        console.warn(`renderTodayContent: Failed to update timezone for ${uid}`, error);
      }
    }

    const todayISO = localDateInTZ(new Date(), tz);
    console.log(`renderTodayContent: Today's date for user ${uid}: ${todayISO}`);

    if (shouldShowMigration(userDoc, todayISO)) {
      console.log(`renderTodayContent: Migration needed for user ${uid}`);
      openMigrationModal(
        async (month, day) => {
          try {
            const updatedUserDoc = await submitMigration(uid, userDoc, month, day, tz);
            if (updatedUserDoc) {
              userDoc = updatedUserDoc;
              await renderContentAfterMigration(uid, userDoc, tz, todayISO);
            }
          } catch (error) {
            console.error(`renderTodayContent: Migration save failed for user ${uid}`, error);
          }
        },
        async () => {
          try {
            await scheduleRePrompt(uid, todayISO);
            await renderContentAfterMigration(uid, userDoc, tz, todayISO);
          } catch (error) {
            console.error(`renderTodayContent: Migration skip failed for user ${uid}`, error);
          }
        }
      );
      return;
    }

    await renderContentAfterMigration(uid, userDoc, tz, todayISO);
  } catch (error) {
    console.error('renderTodayContent: Unexpected error', error);
  }
}

/**
 * Renders content after migration handling
 * @param {string} uid - User ID
 * @param {Object} userDoc - User document
 * @param {string} tz - Timezone
 * @param {string} todayISO - Today's date
 * @returns {Promise<void>}
 */
async function renderContentAfterMigration(uid, userDoc, tz, todayISO) {
  try {
    let groupKey = await ensureActiveGroup(uid, userDoc, tz, async (g) => {
      console.log(`renderContentAfterMigration: No-op initializer for group ${g}`);
    });

    if (!groupKey) {
      const age = derivedAge(userDoc, tz);
      groupKey = ageToGroupKey(age);
      if (!groupKey) {
        console.warn(`renderContentAfterMigration: Invalid group key for user ${uid}, age ${age}`);
        return;
      }
    }

    const items = await loadGroupData(groupKey);
    if (!items.length) {
      console.warn(`renderContentAfterMigration: No items for group ${groupKey}, user ${uid}`);
      return;
    }

    const state = await ensureGroupState(uid, userDoc, groupKey, items.length);
    if (!state) {
      console.warn(`renderContentAfterMigration: Failed to ensure state for user ${uid}, group ${groupKey}`);
      return;
    }

    let finalIndex = computeIndex(state, todayISO, items.length);
    if (userDoc.blockedRefs?.length) {
      finalIndex = applyBlocklist(finalIndex, items, userDoc.blockedRefs);
    }

    await persistServed(uid, groupKey, todayISO, finalIndex);
    const selectedItem = items[finalIndex];
    if (selectedItem) {
      renderItemToDOM(selectedItem);
      console.log(`renderContentAfterMigration: Rendered item for user ${uid}`, selectedItem);
    } else {
      console.warn(`renderContentAfterMigration: No item at index ${finalIndex} for user ${uid}`);
    }
  } catch (error) {
    console.error(`renderContentAfterMigration: Error for user ${uid}`, error);
  }
}

// Initialize auth listener
document.addEventListener('DOMContentLoaded', () => {
  console.log('renderTodayContent: DOM loaded');
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log(`renderTodayContent: User authenticated: ${user.uid}`);
      renderTodayContent();
    } else {
      console.log('renderTodayContent: User signed out');
    }
  });
});

// TODO: Write unit tests for:
// - getUserTZ
// - localDateInTZ
// - daysBetween
// - stableHash
// - countAnniversaries
// - derivedAge
// - ageToGroupKey
// - applyBlocklist