/**
 * Verse Helper Functions
 * Ported from frontend/dashboard-files/content.js
 * Maintains exact same logic for deterministic verse selection
 */

/**
 * Get user timezone or default
 */
function getUserTZ(userDoc) {
  if (userDoc && userDoc.tz) {
    return userDoc.tz;
  }
  
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/**
 * Format date in user's timezone (YYYY-MM-DD)
 */
function localDateInTZ(date, tz) {
  const dateObj = new Date(date);
  
  return Intl.DateTimeFormat('en-CA', { 
    timeZone: tz, 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(dateObj);
}

/**
 * Calculate days between two dates (YYYY-MM-DD format)
 */
function daysBetween(dateA, dateB) {
  // Parse dateA (YYYY-MM-DD) to UTC midnight
  const partsA = dateA.split('-');
  const yearA = parseInt(partsA[0]);
  const monthA = parseInt(partsA[1]) - 1;
  const dayA = parseInt(partsA[2]);
  const utcMidnightA = Date.UTC(yearA, monthA, dayA);

  // Parse dateB (YYYY-MM-DD) to UTC midnight
  const partsB = dateB.split('-');
  const yearB = parseInt(partsB[0]);
  const monthB = parseInt(partsB[1]) - 1;
  const dayB = parseInt(partsB[2]);
  const utcMidnightB = Date.UTC(yearB, monthB, dayB);
  
  // Calculate difference in milliseconds and convert to days
  const diffMs = utcMidnightB - utcMidnightA;
  const days = Math.floor(diffMs / 86400000);
  
  return days;
}

/**
 * Stable hash function for deterministic index
 */
function stableHash(str) {
  let h = 5381;
  
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
  }
  
  return (h >>> 0);
}

/**
 * Count anniversaries (birthdays) between two dates
 */
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

/**
 * Calculate user's current age using 4-strategy approach
 */
function derivedAge(userDoc, tz) {
  if (!userDoc) {
    return 0;
  }
  
  // Use consistent YYYY-MM-DD format throughout
  const todayISO = localDateInTZ(new Date(), tz);
  
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
    // Convert todayISO to full ISO string for countAnniversaries
    const todayDate = new Date(todayISO);
    const anniversaries = countAnniversaries(userDoc.ageSetAt, todayDate.toISOString(), userDoc.birthMonth, userDoc.birthDay, tz);
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

/**
 * Convert age to group key
 */
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

/**
 * Calculate verse index for today
 * Formula: (startIndex + daysBetween(startDate, todayISO)) % N
 */
function computeIndex(state, todayISO, N) {
  if (!state || state.startIndex === undefined || !state.startDate || !N) {
    console.warn('Missing required parameters for computeIndex:', { state, todayISO, N });
    return 0;
  }
  
  // Compute days since start date (minimum 0)
  const dayNumber = Math.max(0, daysBetween(state.startDate, todayISO));
  
  // Calculate today's index: (startIndex + dayNumber) % N
  const todayIndex = (state.startIndex + dayNumber) % N;
  
  return todayIndex;
}

/**
 * Apply blocklist - skip blocked verses (circular search)
 */
function applyBlocklist(index, items, blockedRefs) {
  // If no blocklist or empty blocklist, return original index
  if (!blockedRefs || blockedRefs.length === 0) {
    return index;
  }
  
  // If no items or invalid index, return original index
  if (!items || !Array.isArray(items) || index < 0 || index >= items.length) {
    return index;
  }
  
  let current = index;
  let attempts = 0;
  while (attempts < items.length) {
    const currentItem = items[current];
    if (currentItem && blockedRefs.includes(currentItem.ref)) {
      // Skip blocked content
      current = (current + 1) % items.length;
      attempts++;
    } else {
      // Found non-blocked
      return current;
    }
  }
  
  // All items blocked? Fall back to original index
  console.warn('All items blocked, falling back to original index');
  return index;
}

module.exports = {
  getUserTZ,
  localDateInTZ,
  daysBetween,
  stableHash,
  countAnniversaries,
  derivedAge,
  ageToGroupKey,
  computeIndex,
  applyBlocklist
};
