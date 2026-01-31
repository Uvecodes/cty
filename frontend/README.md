# 🌟 Catch Them Young - Interactive Bible Learning Platform

A comprehensive, age-appropriate Bible learning platform designed to engage children and teenagers (ages 4-17) with daily Bible verses, moral lessons, and interactive challenges. The platform automatically adjusts content based on user age and provides a gamified learning experience with progress tracking.

## 🚀 Live Demo
[Add your live demo link here]

## 📋 Table of Contents
- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Core Features](#core-features)
- [Technical Implementation](#technical-implementation)
- [Database Schema](#database-schema)
- [Content Rendition Logic](#content-rendition-logic)
- [Authentication System](#authentication-system)
- [Progress Tracking System](#progress-tracking-system)
- [Age-Based Content Management](#age-based-content-management)
- [File Structure](#file-structure)
- [Setup & Installation](#setup--installation)
- [Usage Guide](#usage-guide)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Project Overview

**Catch Them Young** is an innovative educational platform that makes Bible learning engaging and age-appropriate for children and teenagers. The platform features:

- **Daily Content Rotation**: Unique Bible verses and lessons every day
- **Age-Adaptive Learning**: Content automatically adjusts as users grow
- **Progress Tracking**: Visual progress bars and achievement systems
- **Interactive Elements**: Checkboxes, challenges, and reflection questions
- **Responsive Design**: Works seamlessly across all devices
- **Real-time Updates**: Live progress updates and notifications

### Target Audience
- **Ages 4-6**: Simple verses with basic moral concepts
- **Ages 7-10**: Expanded lessons with reflection questions
- **Ages 11-13**: Deeper moral discussions and challenges
- **Ages 14-17**: Complex themes and advanced reflection

## 🛠️ Tech Stack

### Frontend Technologies
- **HTML5**: Semantic markup and modern web standards
- **CSS3**: Advanced styling with CSS Grid, Flexbox, and animations
- **JavaScript (ES6+)**: Modern JavaScript with async/await and modules
- **Firebase v8**: Legacy Firebase SDK for authentication and database

### Backend & Database
- **Firebase Authentication**: User management and security
- **Firestore**: NoSQL cloud database for real-time data
- **Firebase Hosting**: Static website hosting and CDN

### Development Tools
- **Node.js**: Package management and development environment
- **Git**: Version control and collaboration
- **VS Code/Cursor**: Development environment

### Firebase Version Details
- **Firebase SDK**: v8.10.1 (Legacy)
- **Firestore**: v2.0.0
- **Authentication**: v0.20.0
- **Hosting**: v9.0.0

## 🏗️ Architecture Overview

The platform follows a **client-side rendered architecture** with Firebase as the backend-as-a-service:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Firebase      │    │   Content       │
│   (HTML/CSS/JS) │◄──►│   Services      │◄──►│   JSON Files    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Browser  │    │   Firestore DB  │    │   Age Groups    │
│   (Local State) │    │   (User Data)   │    │   (4-6, 7-10,  │
└─────────────────┘    └─────────────────┘    │   11-13, 14-17) │
                                              └─────────────────┘
```

### Key Architectural Principles
1. **Single Page Application**: Smooth navigation without page reloads
2. **Real-time Updates**: Live data synchronization via Firestore
3. **Progressive Enhancement**: Core functionality works without JavaScript
4. **Responsive Design**: Mobile-first approach with desktop optimization
5. **Security First**: Firebase Security Rules for data protection

## ⭐ Core Features

### 1. **User Authentication System**
- Secure signup/login with email and password
- Password reset functionality
- Session management and persistence
- User profile management

### 2. **Age-Based Content Delivery**
- Automatic content filtering by age group
- Seamless transitions between age bands
- Birthday-based content updates
- Content appropriateness validation

### 3. **Progress Tracking & Gamification**
- Visual progress bars with real-time updates
- Daily task completion tracking
- Streak counting system
- Achievement notifications

### 4. **Interactive Learning Elements**
- Daily Bible verse display
- Moral lesson explanations
- Reflection questions
- Interactive challenges
- Progress checkboxes

### 5. **Responsive Dashboard**
- Personalized user greetings
- Daily content overview
- Quick navigation to all features
- Real-time progress updates

## 🔧 Technical Implementation

### 1. **Content Management System**

#### Content Structure
Each age group has its own JSON file with structured content:

```json
{
  "ref": "John 3:16",
  "verse_web": "For God so loved the world...",
  "moral": "God's love is unconditional and eternal",
  "challenge": "How can you show love to others today?",
  "topic": "Love",
  "length": "short"
}
```

#### Content Rendition Logic
The platform uses a sophisticated **deterministic daily picker algorithm**:

```javascript
// Core algorithm for daily content selection
function getDailyContent(userId, ageGroup, date) {
  const contentArray = loadContentForAgeGroup(ageGroup);
  const startIndex = hashUserId(userId, ageGroup);
  const daysSinceStart = calculateDaysSinceStart(date);
  const dailyIndex = (startIndex + daysSinceStart) % contentArray.length;
  
  return contentArray[dailyIndex];
}
```

**Key Features of the Rendition System:**
- **Deterministic**: Same user always gets same content on same day
- **No Repeats**: Content cycles through entire collection before repeating
- **Age-Appropriate**: Content automatically filters by user's age group
- **Timezone Aware**: Respects user's local timezone for daily rollovers
- **Caching**: Efficient content delivery with Firestore caching

#### Content Selection Algorithm Deep Dive

```javascript
// 1. User ID Hashing for Consistent Starting Point
function hashUserId(uid, groupKey) {
  let hash = 5381;
  const str = uid + ":" + groupKey;
  
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  
  return Math.abs(hash) % TOTAL_CONTENT_ITEMS;
}

// 2. Daily Index Calculation
function calculateDailyIndex(startIndex, startDate, currentDate) {
  const daysDiff = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
  return (startIndex + daysDiff) % TOTAL_CONTENT_ITEMS;
}

// 3. Content Blocking and Skipping
function applyContentBlocking(index, items, blockedRefs) {
  let currentIndex = index;
  
  while (blockedRefs.includes(items[currentIndex].ref)) {
    currentIndex = (currentIndex + 1) % items.length;
  }
  
  return currentIndex;
}
```

### 2. **User Management System**

#### User Profile Structure
```javascript
const userProfile = {
  uid: "user123",
  name: "John Doe",
  email: "john@example.com",
  birthMonth: 6,
  birthDay: 15,
  ageAtSet: 10,
  ageSetAt: "2024-01-01",
  activeGroup: "7-10",
  streakCount: 5,
  lastVisit: "2024-01-15",
  completedCount: 2,
  verseCompleted: true,
  moralCompleted: false,
  reflectionCompleted: false,
  challengeCompleted: false
};
```

#### Age Calculation Logic
```javascript
function calculateUserAge(userProfile) {
  const today = new Date();
  const birthDate = new Date(today.getFullYear(), userProfile.birthMonth - 1, userProfile.birthDay);
  
  if (today < birthDate) {
    birthDate.setFullYear(birthDate.getFullYear() - 1);
  }
  
  return today.getFullYear() - birthDate.getFullYear();
}

function getAgeGroup(age) {
  if (age >= 4 && age <= 6) return "4-6";
  if (age >= 7 && age <= 10) return "7-10";
  if (age >= 11 && age <= 13) return "11-13";
  if (age >= 14 && age <= 17) return "14-17";
  return null;
}
```

### 3. **Progress Tracking System**

#### Real-Time Progress Updates
The platform implements a sophisticated progress tracking system with 5-second auto-refresh:

```javascript
// Progress Bar Update Function
async function updateProgressBar() {
  try {
    const user = auth.currentUser;
    if (!user) return;
    
    const userDoc = await db.collection("users").doc(user.uid).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      
      // Calculate progress based on completed tasks
      const completedTasks = userData.completedCount || 0;
      const totalTasks = 4;
      const progressPercentage = Math.min((completedTasks / totalTasks) * 100, 100);
      
      // Update UI elements
      updateProgressBarWidth(progressPercentage);
      updateProgressPercentageText(progressPercentage);
    }
  } catch (error) {
    console.error('Error updating progress bar:', error);
  }
}

// Auto-refresh every 5 seconds
function startProgressBarRefresh() {
  const refreshInterval = setInterval(async () => {
    await updateProgressBar();
  }, 5000);
  
  window.progressBarRefreshInterval = refreshInterval;
}
```

#### Task Completion Tracking
```javascript
// Checkbox Event Handler with Progress Update
checkbox1.addEventListener("change", async function () {
  try {
    if (checkbox1.checked) {
      const newCompletedCount = completedCount + 1;
      
      await userRef.set({
        verseCompleted: true,
        completedCount: newCompletedCount,
        lastVisit: today
      }, { merge: true });
      
      // Update dashboard progress immediately
      if (window.updateDashboardProgress) {
        await window.updateDashboardProgress();
      }
    }
  } catch (error) {
    console.error('Error updating completion:', error);
  }
});
```

### 4. **Authentication & Security**

#### Firebase Security Rules
```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Public content can be read by authenticated users
    match /content/{document=**} {
      allow read: if request.auth != null;
    }
  }
}
```

#### User Session Management
```javascript
// Authentication State Observer
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // User is authenticated
    await fetchAndDisplayUserData(user);
    await updateUserStreak(user);
  } else {
    // Redirect to login
    window.location.href = 'authentication/login.html';
  }
});
```

## 🗄️ Database Schema

### Firestore Collections

#### 1. **Users Collection** (`/users/{uid}`)
```javascript
{
  // Basic Information
  name: string,
  email: string,
  age: number, // Legacy field
  
  // Birthday Information
  birthMonth: number, // 1-12
  birthDay: number,   // 1-31
  ageAtSet: number,   // Age when birthday was captured
  ageSetAt: string,   // Date when age was anchored (YYYY-MM-DD)
  
  // Content Management
  activeGroup: string, // "4-6", "7-10", "11-13", "14-17"
  
  // Progress Tracking
  streakCount: number,
  lastVisit: string,   // YYYY-MM-DD
  completedCount: number,
  
  // Individual Task States
  verseCompleted: boolean,
  moralCompleted: boolean,
  reflectionCompleted: boolean,
  challengeCompleted: boolean,
  
  // Content State (per age group)
  contentState: {
    "7-10": {
      startIndex: number,
      startDate: string,
      lastServedDate: string,
      lastServedIndex: number
    }
  }
}
```

#### 2. **Content Collections** (`/content/{ageGroup}`)
```javascript
{
  "4-6": [
    {
      ref: "Genesis 1:1",
      verse_web: "In the beginning God created...",
      moral: "God made everything good",
      challenge: "What did God create today?",
      topic: "Creation",
      length: "short"
    }
  ]
}
```

## 🎨 Content Rendition Logic

### Deep Dive into the Rendition System

The content rendition system is the heart of the platform, ensuring that users receive appropriate, engaging content every day without repetition.

#### 1. **Content Initialization Process**

```javascript
// Content Service Implementation
class ContentService {
  static async getToday(ageGroup) {
    try {
      // Load content for specific age group
      const content = await this.loadContentForAgeGroup(ageGroup);
      
      // Get user's current content state
      const userState = await this.getUserContentState(ageGroup);
      
      // Calculate today's content index
      const todayIndex = this.calculateDailyIndex(userState, content.length);
      
      // Apply any content blocking rules
      const finalIndex = this.applyBlockingRules(todayIndex, content);
      
      // Cache the result for today
      await this.cacheTodayContent(ageGroup, finalIndex);
      
      return content[finalIndex];
    } catch (error) {
      console.error('Error getting today\'s content:', error);
      return null;
    }
  }
}
```

#### 2. **Deterministic Content Selection**

The platform uses a **hash-based deterministic algorithm** to ensure consistent content delivery:

```javascript
// Hash-based User Starting Point
function generateUserStartingPoint(userId, ageGroup) {
  // Use DJB2 hash algorithm for consistency
  let hash = 5381;
  const input = userId + ":" + ageGroup;
  
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
  }
  
  // Ensure positive number and fit within content bounds
  return Math.abs(hash) % TOTAL_CONTENT_ITEMS;
}

// Daily Content Index Calculation
function calculateDailyContentIndex(userState, totalItems) {
  const { startIndex, startDate } = userState;
  const today = new Date().toISOString().split('T')[0];
  
  // Calculate days since user started
  const daysDiff = this.daysBetween(startDate, today);
  
  // Calculate today's index
  const todayIndex = (startIndex + daysDiff) % totalItems;
  
  return todayIndex;
}
```

#### 3. **Content Blocking and Filtering**

Advanced content filtering ensures appropriate content delivery:

```javascript
// Content Blocking System
function applyContentBlocking(index, content, blockedRefs) {
  let currentIndex = index;
  let attempts = 0;
  const maxAttempts = content.length; // Prevent infinite loops
  
  while (attempts < maxAttempts) {
    const currentContent = content[currentIndex];
    
    // Check if content is blocked
    if (blockedRefs.includes(currentContent.ref)) {
      // Move to next item
      currentIndex = (currentIndex + 1) % content.length;
      attempts++;
      continue;
    }
    
    // Check age appropriateness
    if (isContentAgeAppropriate(currentContent, userAge)) {
      return currentIndex;
    }
    
    // Move to next item
    currentIndex = (currentIndex + 1) % content.length;
    attempts++;
  }
  
  // Fallback to original index if no suitable content found
  return index;
}
```

#### 4. **Content Caching and Performance**

Efficient content delivery with multiple caching layers:

```javascript
// Multi-layer Caching System
class ContentCache {
  constructor() {
    this.memoryCache = new Map();
    this.localStorageCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }
  
  async getContent(ageGroup, date) {
    const cacheKey = `${ageGroup}:${date}`;
    
    // Check memory cache first
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey);
      if (this.isCacheValid(cached)) {
        return cached.content;
      }
    }
    
    // Check localStorage cache
    if (this.localStorageCache.has(cacheKey)) {
      const cached = this.localStorageCache.get(cacheKey);
      if (this.isCacheValid(cached)) {
        // Restore to memory cache
        this.memoryCache.set(cacheKey, cached);
        return cached.content;
      }
    }
    
    // Fetch from Firestore
    const content = await this.fetchFromFirestore(ageGroup, date);
    
    // Cache the result
    this.cacheContent(cacheKey, content);
    
    return content;
  }
}
```

#### 5. **Age Group Transition Logic**

Seamless content transitions as users grow:

```javascript
// Age Group Transition Handler
function handleAgeGroupTransition(userProfile) {
  const currentAge = calculateUserAge(userProfile);
  const currentGroup = userProfile.activeGroup;
  const newGroup = getAgeGroup(currentAge);
  
  if (newGroup && newGroup !== currentGroup) {
    // User has moved to a new age group
    return {
      shouldTransition: true,
      fromGroup: currentGroup,
      toGroup: newGroup,
      transitionDate: new Date().toISOString().split('T')[0]
    };
  }
  
  return { shouldTransition: false };
}

// Content State Initialization for New Age Group
async function initializeNewAgeGroup(userId, ageGroup) {
  const contentState = {
    startIndex: generateUserStartingPoint(userId, ageGroup),
    startDate: new Date().toISOString().split('T')[0],
    lastServedDate: null,
    lastServedIndex: null
  };
  
  await db.collection('users').doc(userId).update({
    [`contentState.${ageGroup}`]: contentState,
    activeGroup: ageGroup
  });
  
  return contentState;
}
```

## 📁 File Structure

```
cty/
├── 📁 authentication/           # User authentication system
│   ├── auth.js                 # Firebase auth configuration
│   ├── login.html              # Login page
│   ├── login.js                # Login logic
│   ├── signup.html             # Signup page
│   └── signup.js               # Signup logic
│
├── 📁 dashboard-files/         # Main dashboard functionality
│   ├── dashboard.html          # Main dashboard page
│   ├── dashboard.js            # Dashboard logic and progress tracking
│   ├── checkbox.js             # Interactive checkbox system
│   ├── content.js              # Content management service
│   ├── games.html              # Educational games page
│   ├── leaderboard.html        # User rankings page
│   ├── profile.html            # User profile management
│   └── todaysverse.html        # Daily content display
│
├── 📁 css/                     # Stylesheets
│   ├── style.css               # Global styles
│   ├── dashboard.css           # Dashboard-specific styles
│   ├── login.css               # Authentication styles
│   └── [other component styles]
│
├── 📁 js/                      # Core JavaScript modules
│   ├── firebase-config.js      # Firebase configuration
│   ├── main.js                 # Main application logic
│   ├── notifications.js        # Toast notification system
│   └── leaderboard.js          # Leaderboard functionality
│
├── 📁 assets/                  # Static assets
│   ├── images/                 # Images and logos
│   └── icons/                  # UI icons
│
├── index.html                  # Landing page
├── package.json                # Dependencies and scripts
├── firebase.json               # Firebase configuration
└── README.md                   # This file
```

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v14 or higher)
- Firebase account
- Modern web browser

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/catch-them-young.git
   cd catch-them-young
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Firebase Setup**
   - Create a new Firebase project
   - Enable Authentication and Firestore
   - Download `firebase-config.js` and place in `js/` folder
   - Update Firestore security rules

4. **Configure Environment**
   ```bash
   # Copy and configure Firebase config
   cp js/firebase-config.example.js js/firebase-config.js
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

### Firebase Configuration

1. **Authentication Setup**
   - Enable Email/Password authentication
   - Configure password reset templates
   - Set up user profile fields

2. **Firestore Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

3. **Hosting Configuration**
   ```json
   {
     "hosting": {
       "public": ".",
       "ignore": ["node_modules/**/*"],
       "rewrites": [
         {
           "source": "**",
           "destination": "/index.html"
         }
       ]
     }
   }
   ```

## 📖 Usage Guide

### For Users

1. **Account Creation**
   - Visit the signup page
   - Enter email and password
   - Provide name and age information
   - Complete email verification

2. **Daily Learning**
   - Log in to access dashboard
   - View today's Bible verse and lesson
   - Complete interactive tasks
   - Track progress with visual indicators

3. **Progress Management**
   - Check daily completion status
   - View streak counts and achievements
   - Access profile settings

### For Developers

1. **Adding New Content**
   - Update JSON files in appropriate age group folders
   - Ensure content follows established schema
   - Test content rendering across different age groups

2. **Modifying Features**
   - Follow established code patterns
   - Update Firebase security rules as needed
   - Test authentication and data flow

3. **Customization**
   - Modify CSS for branding changes
   - Update content structure in JavaScript
   - Add new interactive elements

## 🔌 API Documentation

### Firebase Services Used

#### Authentication API
```javascript
// Sign up new user
const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);

// Sign in existing user
const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);

// Sign out user
await firebase.auth().signOut();
```

#### Firestore API
```javascript
// Read user document
const userDoc = await db.collection("users").doc(userId).get();

// Update user data
await db.collection("users").doc(userId).update({
  completedCount: newCount,
  lastVisit: today
});

// Real-time updates
db.collection("users").doc(userId).onSnapshot((doc) => {
  const userData = doc.data();
  updateUI(userData);
});
```

### Custom Functions

#### Progress Tracking
```javascript
// Update dashboard progress
await window.updateDashboardProgress();

// Get user progress
const progress = await getUserProgress(userId);
```

#### Content Management
```javascript
// Get today's content
const content = await ContentService.getToday(ageGroup);

// Initialize user content state
await initializeUserContentState(userId, ageGroup);
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code patterns and style
- Add comprehensive error handling
- Include console logging for debugging
- Test across different age groups
- Ensure responsive design compatibility

### Code Style

- Use meaningful variable and function names
- Include JSDoc comments for complex functions
- Follow ES6+ best practices
- Maintain consistent indentation and formatting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Firebase Team** for providing excellent backend services
- **Bible Gateway** for public domain Bible translations
- **Open Source Community** for inspiration and tools
- **Beta Testers** for valuable feedback and suggestions

## 📞 Support

For support and questions:
- **Email**: support@catchthemyoung.com
- **Issues**: [GitHub Issues](https://github.com/yourusername/catch-them-young/issues)
- **Documentation**: [Project Wiki](https://github.com/yourusername/catch-them-young/wiki)

---

**Built with ❤️ for the next generation of learners**

*Last updated: January 2025*

