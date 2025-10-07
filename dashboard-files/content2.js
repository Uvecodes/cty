// Initialize Firebase
  // const firebaseConfig = {
  //   apiKey: "AIzaSyCRjTTx_FOCFybP5Dhp2Bz82NQN1n-9fJ4",
  //   authDomain: "catch-them-young-16da5.firebaseapp.com",
  //   projectId: "catch-them-young-16da5",
  //   storageBucket: "catch-them-young-16da5.firebasestorage.app",
  //   messagingSenderId: "777589364823",
  //   appId: "1:777589364823:web:ee9f214c01c7d9779aab12",
  //   measurementId: "G-H517ECEK72",
  // };
// Initialize Firebase
// firebase.initializeApp(firebaseConfig);

// Get Firestore instance
// const db = firebase.firestore();


function getUserTZ(userDoc) {
  if (userDoc && userDoc.tz) {
    return userDoc.tz;
  }
  
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}




function localDateInTZ(date, tz) {
  const dateObj = new Date(date);
  
  return Intl.DateTimeFormat('en-CA', { 
    timeZone: tz, 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(dateObj);
}





function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  
  // Convert both dates to UTC midnight to avoid DST drift
  const utcMidnightA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const utcMidnightB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  
  // Calculate difference in milliseconds and convert to days
  const diffMs = utcMidnightB - utcMidnightA;
  const days = Math.floor(diffMs / 86400000);
  
  console.log(`daysBetween: ${dateA} to ${dateB} = ${days} days`);
  
  return days;
}


function stableHash(str) {
  let h = 5381;
  
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
  }
  
  return (h >>> 0);
}


function countAnniversaries(startISO, endISO, month, day, tz) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  
  // Handle leap day rule: treat Feb 29 as Feb 28 for counting
  let targetMonth = month;
  let targetDay = day;
  if (month === 2 && day === 29) {
    targetMonth = 2;
    targetDay = 28;
  }
  
  let count = 0;
  
  // Ensure we start from the beginning of the start date in the user's timezone
  const startDateInTZ = localDateInTZ(start, tz);
  const startParts = startDateInTZ.split('-');
  const startYear = parseInt(startParts[0]);
  const startMonth = parseInt(startParts[1]);
  const startDay = parseInt(startParts[2]);
  
  // Check if start date is on or after the target month/day
  let firstYear = startYear;
  if (startMonth > targetMonth || (startMonth === targetMonth && startDay > targetDay)) {
    firstYear = startYear + 1;
  }
  
  // Count occurrences from first possible year to end year
  const endDateInTZ = localDateInTZ(end, tz);
  const endYear = parseInt(endDateInTZ.split('-')[0]);
  
  for (let year = firstYear; year <= endYear; year++) {
    // Check if this year has the target month/day
    const targetDate = new Date(year, targetMonth - 1, targetDay);
    
    // Convert target date to user's timezone for comparison
    const targetDateInTZ = localDateInTZ(targetDate, tz);
    
    // Check if this occurrence falls within our range
    if (targetDateInTZ >= startDateInTZ && targetDateInTZ <= endDateInTZ) {
      count++;
    }
  }
  
  return Math.max(0, count);
}


function derivedAge(userDoc, tz) {
  if (!userDoc) {
    return 0;
  }
  
  const todayISO = new Date().toISOString();
  
  // Strategy 1: Exact age from DOB if available
  if (userDoc.dob) {
    const dob = new Date(userDoc.dob);
    const today = new Date(todayISO);
    const ageInMs = today - dob;
    const ageInYears = ageInMs / (365.25 * 24 * 60 * 60 * 1000);
    return Math.floor(ageInYears);
  }
  
  // Strategy 2: Calculate from birth month/day + ageAtSet + ageSetAt
  if (userDoc.birthMonth && userDoc.birthDay && userDoc.ageAtSet && userDoc.ageSetAt) {
    const anniversaries = countAnniversaries(userDoc.ageSetAt, todayISO, userDoc.birthMonth, userDoc.birthDay, tz);
    return userDoc.ageAtSet + anniversaries;
  }
  
  // Strategy 3: Crude fallback using age + ageSetAt + whole years
  if (userDoc.age && userDoc.ageSetAt) {
    const daysDiff = daysBetween(userDoc.ageSetAt, todayISO);
    const yearsDiff = Math.floor(daysDiff / 365.2425);
    return userDoc.age + yearsDiff;
  }
  
  // Strategy 4: Final fallback to existing age field
  return Number(userDoc.age || 0);
}


function ageToGroupKey(age) {
  if (age >= 4 && age <= 6) {
    return "4-6";
  } else if (age >= 7 && age <= 10) {
    return "7-10";
  } else if (age >= 11 && age <= 13) {
    return "11-13";
  } else if (age >= 14 && age <= 17) {
    return "14-17";
  } else {
    return null;
  }
}


async function ensureActiveGroup(uid, userDoc, tz, initializer) {
  if (!userDoc) {
    return null;
  }
  
  // Compute current age group based on derived age
  const currentAge = derivedAge(userDoc, tz);
  const currentKey = ageToGroupKey(currentAge);
  
  if (!currentKey) {
    console.warn(`User ${uid} has invalid age: ${currentAge}`);
    return null;
  }
  
  // If active group is already current, return it
  if (userDoc.activeGroup === currentKey) {
    return currentKey;
  }
  
  // Group has changed - log audit and update
  const oldGroup = userDoc.activeGroup || 'none';
  console.log(`User ${uid} group change: ${oldGroup} → ${currentKey} (age: ${currentAge})`);
  
  // Update active group in Firestore
  try {
    await db.collection('users').doc(uid).set({
      activeGroup: currentKey
    }, { merge: true });
  } catch (error) {
    console.error(`Failed to update active group for user ${uid}:`, error);
    return null;
  }
  
  // Initialize content state for new group if needed and initializer provided
  if (initializer && (!userDoc.contentState || !userDoc.contentState[currentKey])) {
    try {
      await initializer(currentKey);
    } catch (error) {
      console.error(`Failed to initialize content state for group ${currentKey} for user ${uid}:`, error);
      // Continue even if initialization fails
    }
  }
  
  return currentKey;
}


function groupPath(groupKey) {
  switch (groupKey) {
    case "4-6":
      return "/dashboard-files/content-4-6.json";
    case "7-10":
      return "/dashboard-files/content-7-10.json";
    case "11-13":
      return "/dashboard-files/content-11-13.json";
    case "14-17":
      return "/dashboard-files/content-14-17.json";
    default:
      return null;
  }
}


async function loadGroupData(groupKey) {
  // Get the file path for the group
  const path = groupPath(groupKey);
  if (!path) {
    console.warn('Could not determine path for group:', groupKey);
    return [];
  }
  
  try {
    // Fetch the JSON data with no-cache policy
    const response = await fetch(path, { cache: "no-store" });
    
    if (!response.ok) {
      console.warn(`Failed to fetch data for group ${groupKey}:`, response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    
    // Validate that data is an array
    if (!Array.isArray(data)) {
      console.warn(`Data for group ${groupKey} is not an array:`, typeof data);
      return [];
    }
    
    return data;
    
  } catch (error) {
    console.warn(`Error loading data for group ${groupKey}:`, error);
    return [];
  }
}


async function ensureGroupState(uid, userDoc, groupKey, N) {
  if (!userDoc || !groupKey || !N) {
    console.warn('Missing required parameters for ensureGroupState:', { uid, hasUserDoc: !!userDoc, groupKey, N });
    return null;
  }
  
  // Check if content state already exists for this group
  if (userDoc.contentState && userDoc.contentState[groupKey] && 
      userDoc.contentState[groupKey].startIndex !== undefined && 
      userDoc.contentState[groupKey].startDate) {
    return userDoc.contentState[groupKey];
  }
  
  // Initialize new content state for the group
  const tz = getUserTZ(userDoc);
  const startIndex = stableHash(uid + ":" + groupKey) % N;
  const startDate = localDateInTZ(new Date(), tz);
  
  const newState = {
    startIndex: startIndex,
    startDate: startDate,
    lastServedDate: "", // Start with empty string to allow first day content
    lastServedIndex: -1
  };
  
  try {
    // Write the new state to Firestore using merge to preserve other groups
    await db.collection('users').doc(uid).set({
      [`contentState.${groupKey}`]: newState
    }, { merge: true });
    
    console.log(`Initialized content state for user ${uid} group ${groupKey}:`, newState);
    return newState;
    
  } catch (error) {
    console.error(`Failed to initialize content state for user ${uid} group ${groupKey}:`, error);
    return null;
  }
}


function computeIndex(state, todayISO, N) {
  if (!state || state.startIndex === undefined || !state.startDate || !N) {
    console.warn('Missing required parameters for computeIndex:', { state, todayISO, N });
    return 0;
  }
  
  // Compute days since start date (minimum 0)
  const dayNumber = Math.max(0, daysBetween(state.startDate, todayISO));
  
  // Calculate today's index: (startIndex + dayNumber) % N
  const todayIndex = (state.startIndex + dayNumber) % N;
  
  console.log(`computeIndex: startIndex=${state.startIndex}, dayNumber=${dayNumber}, todayIndex=${todayIndex}, N=${N}`);
  
  return todayIndex;
}


function applyBlocklist(index, items, blockedRefs) {
  // If no blocklist or empty blocklist, return original index
  if (!blockedRefs || blockedRefs.length === 0) {
    return index;
  }
  
  // If no items or invalid index, return original index
  if (!items || !Array.isArray(items) || index < 0 || index >= items.length) {
    return index;
  }
  
  // Check if current item is blocked
  const currentItem = items[index];
  if (currentItem && blockedRefs.includes(currentItem.ref)) {
    // Advance once to skip blocked content
    const nextIndex = (index + 1) % items.length;
    console.log(`Skipping blocked content at index ${index} (ref: ${currentItem.ref}), advancing to index ${nextIndex}`);
    return nextIndex;
  }
  
  // No blocking needed, return original index
  return index;
}


async function persistServed(uid, groupKey, todayISO, index) {
  if (!uid || !groupKey || !todayISO || index === undefined) {
    console.warn('Missing required parameters for persistServed:', { uid, groupKey, todayISO, index });
    return false;
  }
  
  // Update Firestore with served content information
  const todayDateOnly = todayISO.split('T')[0]; // Get just the date part for consistency
  try {
    await db.collection('users').doc(uid).set({
      [`contentState.${groupKey}.lastServedDate`]: todayDateOnly,
      [`contentState.${groupKey}.lastServedIndex`]: index
    }, { merge: true });
    
    console.log(`Persisted served content for user ${uid} group ${groupKey}: date=${todayDateOnly}, index=${index}`);
  } catch (error) {
    console.error(`Failed to persist served content to Firestore for user ${uid} group ${groupKey}:`, error);
    return false;
  }
  
  // Update localStorage (non-blocking, no throws)
  try {
    const localStorageKey = `cty_${groupKey}_${todayISO}`;
    localStorage.setItem(localStorageKey, String(index));
    console.log(`Persisted served content to localStorage: ${localStorageKey} = ${index}`);
  } catch (storageError) {
    console.warn(`Failed to persist served content to localStorage for user ${uid} group ${groupKey}:`, storageError);
    // Continue execution even if localStorage fails
  }
  
  return true;
}


function renderItemToDOM(item) {
  if (!item) {
    console.warn('renderItemToDOM: No item provided');
    return;
  }
  
  // Define the DOM element IDs to populate
  const elementIds = ['ref', 'passage', 'moral', 'reflectionQ', 'challenge'];
  
  // Populate each element with content from the item
  elementIds.forEach(elementId => {
    const element = document.getElementById(elementId);
    if (element) {
      // Get the content from the item, defaulting to empty string if missing
      const content = item[elementId] || '';
      element.textContent = content;
    } else {
      // Log warning if element is missing but don't throw
      console.warn(`renderItemToDOM: Element with id '${elementId}' not found`);
    }
  });
}


function shouldShowMigration(userDoc, todayISO) {
  if (!userDoc || !todayISO) {
    console.warn('shouldShowMigration: Missing required parameters');
    return false;
  }
  
  // Check if either birthMonth or birthDay is missing
  const hasBirthInfo = userDoc.birthMonth && userDoc.birthDay;
  
  if (!hasBirthInfo) {
    // If birth info is missing, check if we should show migration
    if (!userDoc.migrationSkipUntil) {
      // No skip date set, show migration
      return true;
    }
    
    // Check if skip date has passed (compare as date strings to avoid timezone issues)
    if (todayISO >= userDoc.migrationSkipUntil) {
      // Skip date has passed, show migration
      return true;
    }
    
    // Still within skip period, don't show migration
    return false;
  }
  
  // User has birth info, no migration needed
  return false;
}


async function scheduleRePrompt(uid, todayISO, days = 7) {
  if (!uid || !todayISO || days === undefined) {
    console.warn('scheduleRePrompt: Missing required parameters:', { uid, todayISO, days });
    return false;
  }
  
  try {
    // Calculate the skip until date (parse todayISO as YYYY-MM-DD and add days)
    const [year, month, day] = todayISO.split('-').map(Number);
    const today = new Date(year, month - 1, day); // month is 0-indexed
    const skipUntil = new Date(today);
    skipUntil.setDate(today.getDate() + days);
    
    // Format as YYYY-MM-DD
    const skipUntilFormatted = skipUntil.toISOString().split('T')[0];
    
    // Update user document with migration skip date
    await db.collection('users').doc(uid).set({
      migrationSkipUntil: skipUntilFormatted
    }, { merge: true });
    
    console.log(`Scheduled migration re-prompt for user ${uid} until ${skipUntilFormatted} (${days} days from today)`);
    return true;
    
  } catch (error) {
    console.error(`Failed to schedule migration re-prompt for user ${uid}:`, error);
    return false;
  }
}


function openMigrationModal(onSave, onSkip) {
  if (!onSave || !onSkip) {
    console.warn('openMigrationModal: Missing required callbacks');
    return;
  }
  
  // Test stub: immediately call onSave with test values
  // In production, this would open a modal UI
  const testMonth = 6;  // June
  const testDay = 15;   // 15th
  
  console.log(`Migration modal stub: Simulating user input - Month: ${testMonth}, Day: ${testDay}`);
  onSave(testMonth, testDay);
  
  // Note: onSkip() would be called if user dismisses modal
  // For testing, we're calling onSave immediately
}


async function submitMigration(uid, userDoc, month, day, tz) {
  if (!uid || !userDoc || month === undefined || day === undefined || !tz) {
    console.warn('submitMigration: Missing required parameters:', { uid, hasUserDoc: !!userDoc, month, day, tz });
    return null;
  }
  
  // Validate month range (1-12)
  if (month < 1 || month > 12) {
    console.warn(`submitMigration: Invalid month ${month}, must be 1-12`);
    return null;
  }
  
  // Validate day range (1-31)
  if (day < 1 || day > 31) {
    console.warn(`submitMigration: Invalid day ${day}, must be 1-31`);
    return null;
  }
  
  try {
    // Compute today's date in user's timezone
    const todayISO = localDateInTZ(new Date(), tz);
    
    // Calculate current age for ageAtSet
    const currentAge = Number(userDoc.age || derivedAge(userDoc, tz));
    
    // Prepare migration data
    const migrationData = {
      birthMonth: month,
      birthDay: day,
      ageAtSet: currentAge,
      ageSetAt: todayISO
    };
    
    // Update user document with migration data
    await db.collection('users').doc(uid).set(migrationData, { merge: true });
    
    console.log(`Migration submitted for user ${uid}:`, migrationData);
    
    // Return merged shape for test assertions
    return {
      ...userDoc,
      ...migrationData
    };
    
  } catch (error) {
    console.error(`Failed to submit migration for user ${uid}:`, error);
    return null;
  }
}

/**
 * Renders today's content for the authenticated user
 * @returns {Promise<void>}
 */
async function renderTodayContent() {
  try {
    // Get current authenticated user
    const user = firebase.auth().currentUser;
    if (!user) {
      console.log('renderTodayContent: No authenticated user, returning silently');
      return;
    }
    
    const uid = user.uid;
    console.log(`renderTodayContent: Starting for user ${uid}`);
    
    // Read user document from Firestore
    let userDoc;
    try {
      const userSnapshot = await db.collection('users').doc(uid).get();
      if (!userSnapshot.exists) {
        console.warn(`renderTodayContent: User document not found for ${uid}`);
        return;
      }
      userDoc = userSnapshot.data();
      console.log(`renderTodayContent: Retrieved user document for ${uid}`);
    } catch (error) {
      console.error(`renderTodayContent: Failed to read user document for ${uid}:`, error);
      return;
    }
    
    // Ensure timezone is set
    let tz = userDoc.tz;
    if (!tz) {
      tz = getUserTZ(userDoc);
      console.log(`renderTodayContent: Setting timezone for user ${uid}: ${tz}`);
      
      try {
        await db.collection('users').doc(uid).set({ tz }, { merge: true });
        userDoc.tz = tz; // Update local copy
        console.log(`renderTodayContent: Timezone updated for user ${uid}`);
      } catch (error) {
        console.warn(`renderTodayContent: Failed to update timezone for user ${uid}:`, error);
        // Continue with current timezone
      }
    }
    
    // Calculate today's date in user's timezone
    const todayISO = localDateInTZ(new Date(), tz);
    console.log(`renderTodayContent: Today's date for user ${uid}: ${todayISO} (tz: ${tz})`);
    
    // Check if migration should be shown
    if (shouldShowMigration(userDoc, todayISO)) {
      console.log(`renderTodayContent: Migration needed for user ${uid}, opening modal`);
      
      // Open migration modal
      openMigrationModal(
        // onSave callback
        async (month, day) => {
          console.log(`renderTodayContent: Migration save callback for user ${uid}: month=${month}, day=${day}`);
          try {
            const updatedUserDoc = await submitMigration(uid, userDoc, month, day, tz);
            if (updatedUserDoc) {
              userDoc = updatedUserDoc; // Update local copy
              console.log(`renderTodayContent: Migration completed for user ${uid}, proceeding with content`);
              // Continue with content rendering
              await renderContentAfterMigration(uid, userDoc, tz, todayISO);
            } else {
              console.warn(`renderTodayContent: Migration failed for user ${uid}, cannot proceed`);
            }
          } catch (error) {
            console.error(`renderTodayContent: Error in migration save callback for user ${uid}:`, error);
          }
        },
        // onSkip callback
        async () => {
          console.log(`renderTodayContent: Migration skip callback for user ${uid}`);
          try {
            await scheduleRePrompt(uid, todayISO, 7);
            console.log(`renderTodayContent: Migration skip scheduled for user ${uid}, proceeding with legacy age path`);
            // Continue with content rendering using legacy age
            await renderContentAfterMigration(uid, userDoc, tz, todayISO);
          } catch (error) {
            console.error(`renderTodayContent: Error in migration skip callback for user ${uid}:`, error);
          }
        }
      );
      return; // Exit early, content will be rendered in callbacks
    }
    
    // No migration needed, proceed with content rendering
    await renderContentAfterMigration(uid, userDoc, tz, todayISO);
    
  } catch (error) {
    console.error('renderTodayContent: Unexpected error:', error);
    // No throws, just log and continue
  }
}


async function renderContentAfterMigration(uid, userDoc, tz, todayISO) {
  try {
    console.log(`renderContentAfterMigration: Starting for user ${uid}`);
    
    // Compute group key
    let groupKey = await ensureActiveGroup(uid, userDoc, tz, async (g) => {
      // No-op initializer as specified
      console.log(`renderContentAfterMigration: No-op initializer called for group ${g}`);
    });
    
    // Fallback to direct age calculation if ensureActiveGroup fails
    if (!groupKey) {
      console.log(`renderContentAfterMigration: ensureActiveGroup failed for user ${uid}, using fallback`);
      const age = derivedAge(userDoc, tz);
      groupKey = ageToGroupKey(age);
      
      if (!groupKey) {
        console.warn(`renderContentAfterMigration: Could not determine group key for user ${uid} (age: ${age})`);
        return;
      }
      console.log(`renderContentAfterMigration: Fallback group key for user ${uid}: ${groupKey}`);
    }
    
    console.log(`renderContentAfterMigration: Using group key for user ${uid}: ${groupKey}`);
    
    // Load group data
    const items = await loadGroupData(groupKey);
    if (!items || items.length === 0) {
      console.warn(`renderContentAfterMigration: No items loaded for group ${groupKey}, user ${uid}`);
      return;
    }
    
    console.log(`renderContentAfterMigration: Loaded ${items.length} items for group ${groupKey}, user ${uid}`);
    
    // Ensure group state
    const state = await ensureGroupState(uid, userDoc, groupKey, items.length);
    if (!state) {
      console.warn(`renderContentAfterMigration: Failed to ensure group state for user ${uid}, group ${groupKey}`);
      return;
    }
    
    console.log(`renderContentAfterMigration: Group state ensured for user ${uid}, group ${groupKey}:`, state);
    
    // Compute raw index
    const rawIndex = computeIndex(state, todayISO, items.length);
    console.log(`renderContentAfterMigration: Raw index computed for user ${uid}: ${rawIndex}`);
    console.log(`renderContentAfterMigration: State details - startIndex: ${state.startIndex}, startDate: ${state.startDate}, lastServedDate: ${state.lastServedDate}, lastServedIndex: ${state.lastServedIndex}`);
    console.log(`renderContentAfterMigration: Today's date: ${todayISO}, Total items: ${items.length}`);
    
    // Apply blocklist if present (optional)
    let finalIndex = rawIndex;
    if (userDoc.blockedRefs && Array.isArray(userDoc.blockedRefs)) {
      console.log(`renderContentAfterMigration: Applying blocklist for user ${uid}, ${userDoc.blockedRefs.length} blocked refs`);
      finalIndex = applyBlocklist(rawIndex, items, userDoc.blockedRefs);
      if (finalIndex !== rawIndex) {
        console.log(`renderContentAfterMigration: Index adjusted from ${rawIndex} to ${finalIndex} due to blocklist`);
      }
    } else {
      console.log(`renderContentAfterMigration: No blocklist for user ${uid}, using raw index`);
    }
    
    // Persist served content
    const persistSuccess = await persistServed(uid, groupKey, todayISO, finalIndex);
    if (!persistSuccess) {
      console.warn(`renderContentAfterMigration: Failed to persist served content for user ${uid}, group ${groupKey}`);
      // Continue anyway to show content
    }
    
    // Render item to DOM
    const selectedItem = items[finalIndex];
    if (selectedItem) {
      console.log(`renderContentAfterMigration: Rendering item for user ${uid}:`, selectedItem);
      renderItemToDOM(selectedItem);
      console.log(`renderContentAfterMigration: Content rendered successfully for user ${uid}`);
    } else {
      console.warn(`renderContentAfterMigration: No item found at index ${finalIndex} for user ${uid}`);
    }
    
  } catch (error) {
    console.error(`renderContentAfterMigration: Error for user ${uid}:`, error);
    // No throws, just log and continue
  }
}

// Hook up renderTodayContent on DOMContentLoaded and auth state changes
document.addEventListener('DOMContentLoaded', () => {
  console.log('renderTodayContent: DOM loaded, setting up auth listener');
  
  // Set up Firebase auth state listener
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log(`renderTodayContent: User authenticated: ${user.uid}, rendering content`);
      renderTodayContent();
    } else {
      console.log('renderTodayContent: User signed out, no content to render');
    }
  });
});


// Update date display immediately
// nb: this is a simple static update, not tied to user auth and also it is a quick fix due to file conflicting loads due to to preview feature as dashboard.js no longer runs in todaysvers.html. future look out and scaling would be advised
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


      // PWA: install prompt
(function installPrompt(){
  var deferred;
  var btn = document.getElementById('installBtn');
  if (!btn) return;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    btn.style.display = '';
  });

  btn.addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function(){
      deferred = null;
      btn.style.display = 'none';
    });
  });
})();
