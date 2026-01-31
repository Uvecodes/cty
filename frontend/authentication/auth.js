// // console.log() redec;laration to avoid errors in some environments
// console.log = function() {};
// console.warn = function() {};
// console.error = function() {};
// console.info = function() {};



// // Overall Architecture:
// // This file creates a complete authentication system that:
// // Works on both signup and login pages using the same code
// // Provides user feedback through toast notifications
// // Handles all authentication scenarios (signup, login, logout, password reset)
// // Protects routes by monitoring authentication state
// // Uses Firebase v8 for compatibility and simplicity
// // Follows best practices for error handling and user experience
// // The file is designed to be smart - it automatically detects which page it's on and sets up the appropriate functionality without conflicts.




// // Global Toast Notification System
// function showToast(message, type = "success") {
//   const toast = document.getElementById("toast");
//   if (!toast) return;

//   // Clear any existing timeout
//   if (toast.timeoutId) {
//     clearTimeout(toast.timeoutId);
//   }

//   // Set message and type
//   toast.textContent = message;
//   toast.className = `toast show ${type}`;

//   // Hide toast after 3 seconds
//   toast.timeoutId = setTimeout(() => {
//     toast.classList.remove("show");
//     setTimeout(() => {
//       toast.classList.add("hidden");
//     }, 300);
//   }, 3000);
// }
// // comment: This function can be called from anywhere in your app to show a toast notification
// // Purpose: Creates user-friendly popup messages
// // Logic:
// // Finds the toast element in the HTML
// // Clears any existing toast to prevent overlapping
// // Sets the message text and styling (success/error/info/warning)
// // Shows the toast for 3 seconds, then hides it with a smooth animation
// // Uses CSS classes to control visibility and styling

// // Firebase Configuration
// const firebaseConfig = {
//   apiKey: "AIzaSyCRjTTx_FOCFybP5Dhp2Bz82NQN1n-9fJ4",
//   authDomain: "catch-them-young-16da5.firebaseapp.com",
//   projectId: "catch-them-young-16da5",
//   storageBucket: "catch-them-young-16da5.firebasestorage.app",
//   messagingSenderId: "777589364823",
//   appId: "1:777589364823:web:ee9f214c01c7d9779aab12",
//   measurementId: "G-H517ECEK72",
// };

// // Initialize Firebase (only if not already initialized)
// if (!firebase.apps.length) {
//   firebase.initializeApp(firebaseConfig);
// }

// const auth = firebase.auth();
// const db = firebase.firestore();

// // comment for the above code
// // Purpose: Sets up Firebase connection and services
// // Logic:
// // Contains your Firebase project credentials
// // Checks if Firebase is already initialized (prevents duplicate initialization errors)
// // Creates auth object for user authentication (login, signup, logout)
// // Creates db object for Firestore database operations

// //below are the functions for authentication
// // Import offline detection (you'll need to add this)
// // For now, we'll add the offline check directly in the functions

// // // Register Function
// // async function register(event) {
// //   // Check if user is offline
// //   event.preventDefault(); // Prevent form submission from refreshing the page
// // if (!navigator.onLine) {
// //   showToast("Sorry, you are currently offline");
// //   return;
// // }
  

// //   const name = document.getElementById("fullName").value.trim();
// //   const age = document.getElementById("age").value;
// //   const email = document.getElementById("email").value.trim();
// //   const password = document.getElementById("password").value;
// //   const confirmPassword = document.getElementById("confirm-password").value;

// //   // Validation
// //   if (!name || !age || !email || !password || !confirmPassword) {
// //     showToast("Please fill all fields.");
// //     return;
// //   }

// //   if (password !== confirmPassword) {
// //     showToast("Passwords do not match.");
// //     return;
// //   }

// //   if (age < 4 || age > 17) {
// //     showToast("Age must be between 4 and 17.");
// //     return;
// //   }

// //   try {
// //     // Set persistence to SESSION (default) or LOCAL based on your needs
// //     await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
// //     const userCredential = await auth.createUserWithEmailAndPassword(email, password);
// //     const user = userCredential.user;

// //     // Save extra data to Firestore
// //     await db
// //       .collection("users")
// //       .doc(user.uid)
// //       .set({
// //         name,
// //         age: parseInt(age),
// //         email,
// //         createdAt: firebase.firestore.FieldValue.serverTimestamp(),
// //       });

// //     showToast("Registered and logged in!");
// //     window.location.href = "../dashboard-files/dashboard.html";
// //   } catch (error) {
// //     console.error("Signup error:");
// //     showToast("error");
// //   }



 
// // }


// // // Register Function
// // async function register(event) {
// //   // Check if user is offline
// //   event.preventDefault(); // Prevent form submission from refreshing the page
// //   if (!navigator.onLine) {
// //     showToast("Sorry, you are currently offline");
// //     return;
// //   }

// //   const name = document.getElementById("fullName").value.trim();
// //   const age = document.getElementById("age").value;
// //   const email = document.getElementById("email").value.trim();
// //   const password = document.getElementById("password").value;
// //   const confirmPassword = document.getElementById("confirm-password").value;

// //   // Validation
// //   if (!name || !age || !email || !password || !confirmPassword) {
// //     showToast("Please fill all fields.");
// //     return;
// //   }

// //   if (password !== confirmPassword) {
// //     showToast("Passwords do not match.");
// //     return;
// //   }

// //   if (age < 4 || age > 17) {
// //     showToast("Age must be between 4 and 17.");
// //     return;
// //   }

// //   try {
// //     // Set persistence
// //     await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
// //     const userCredential = await auth.createUserWithEmailAndPassword(email, password);
// //     const user = userCredential.user;

// //     // Save extra data to Firestore
// //     await db
// //       .collection("users")
// //       .doc(user.uid)
// //       .set({
// //         name,
// //         age: parseInt(age),
// //         email,
// //         createdAt: firebase.firestore.FieldValue.serverTimestamp(),
// //       });

// //     // ✅ TRIGGER WELCOME EMAIL VIA YOUR MINIMAL BACKEND
// //     try {
// //       const emailResponse = await fetch('http://localhost:3001/send-welcome', {
// //         method: 'POST',
// //         headers: { 'Content-Type': 'application/json' },
// //         body: JSON.stringify({
// //           email: user.email,
// //           displayName: name
// //         })
// //       });

// //       if (!emailResponse.ok) {
// //         console.warn('Failed to trigger welcome email, but user was created.');
// //       }
// //     } catch (emailError) {
// //       // Don't fail registration if email fails – it's non-critical
// //       console.error('Email trigger error:', emailError);
// //     }

// //     showToast("Registered and logged in!");
// //     window.location.href = "../dashboard-files/dashboard.html";
// //   } catch (error) {
// //     console.error("Signup error:", error);
// //     // Show a more helpful message
// //     let message = "Registration failed. Please try again.";
// //     if (error.code === "auth/email-already-in-use") {
// //       message = "This email is already registered.";
// //     } else if (error.code === "auth/invalid-email") {
// //       message = "Please enter a valid email.";
// //     } else if (error.code === "auth/weak-password") {
// //       message = "Password must be at least 6 characters.";
// //     }
// //     showToast(message, "error");
// //   }
// // }




// // Register Function
// async function register(event) {
//   event.preventDefault(); // Prevent form refresh

//   // Offline check
//   if (!navigator.onLine) {
//     showToast("Sorry, you are currently offline");
//     return;
//   }

//   const name = document.getElementById("fullName").value.trim();
//   const age = document.getElementById("age").value;
//   const email = document.getElementById("email").value.trim();
//   const password = document.getElementById("password").value;
//   const confirmPassword = document.getElementById("confirm-password").value;

//   // Validation
//   if (!name || !age || !email || !password || !confirmPassword) {
//     showToast("Please fill all fields.");
//     return;
//   }

//   if (password !== confirmPassword) {
//     showToast("Passwords do not match.");
//     return;
//   }

//   if (age < 4 || age > 17) {
//     showToast("Age must be between 4 and 17.");
//     return;
//   }

//   try {
//     // Call backend API to register user
//     const response = await fetch('http://localhost:3001/api/auth/register', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ email, password, name, age: parseInt(age) })
//     });

//     const data = await response.json();

//     if (!response.ok) {
//       throw new Error(data.message || data.error || 'Registration failed');
//     }

//     // Backend returns a custom token, use it to sign in with Firebase Client SDK
//     await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
//     const userCredential = await auth.signInWithCustomToken(data.token);
//     const user = userCredential.user;

//     // ✅ Trigger welcome email via your backend (non-blocking)
//     try {
//       const emailResponse = await fetch('https://cty-7cyi.onrender.com/send-welcome', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           email: user.email,
//           displayName: name
//         })
//       });

//       if (!emailResponse.ok) {
//         console.warn('Email service returned error:', emailResponse.status);
//       } else {
//         console.log('Welcome email triggered successfully');
//       }
//     } catch (emailError) {
//       // Log but don't stop registration — email is secondary
//       console.error('Failed to trigger welcome email:', emailError);
//     }

//     // Success! Show toast and redirect to dashboard
//     showToast("Registered and logged in!");
    
//     // Redirect to dashboard after a short delay to show the success message
//     setTimeout(() => {
//       window.location.href = "../dashboard-files/dashboard.html";
//     }, 1500);

//   } catch (error) {
//     console.error("Registration error:", error);

//     // Show user-friendly error
//     let message = error.message || "Registration failed. Please try again.";
//     showToast(message, "error");
//   }
// }


// // comment: This function handles user registration

// // Purpose: Handles new user account creation
// // Logic:
// // Prevents default form behavior (page refresh)
// // Gets form values: name, age, email, password, confirm password
// // Validates input: checks all fields are filled, passwords match, age is valid (4-17)
// // Creates Firebase user account with email/password
// // Sets session persistence (user stays logged in during browser session)
// // Saves additional user data to Firestore database (name, age, creation time)
// // Shows success message and redirects to dashboard
// // Error handling shows user-friendly error messages


// // Forgot Password Function
// async function forgotPassword() {
//   const email = prompt("Please enter your email address to reset your password:");

//   if (!email) {
//     showToast("Email is required");
//     return;
//   }

//   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//   if (!emailRegex.test(email)) {
//     showToast("Please enter a valid email address");
//     return;
//   }

//   try {
//     // Call backend API for password reset
//     const response = await fetch('http://localhost:3001/api/auth/forgot-password', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ email })
//     });

//     const data = await response.json();

//     if (!response.ok) {
//       throw new Error(data.message || data.error || 'Password reset failed');
//     }

//     showToast(data.message || "Password reset email sent!");
//   } catch (error) {
//     console.error("Password reset error:", error);
//     showToast(error.message || "An error occurred. Please try again.", "error");
//   }
// }

// // comment: This function handles password reset requests
// // Purpose: Allows users to reset forgotten passwords
// // Logic:
// // Prompts user for email address
// // Validates email is not empty
// // Checks email format using regex pattern
// // Sends password reset email via Firebase
// // Shows success/error messages to user

// // Login Function
// async function login(event) {
//   event.preventDefault(); // Prevent form submission
  
//   // Check if user is offline
//   if (!navigator.onLine) {
//     showToast("Sorry, you are currently offline");
//     return;
//   }

//   const email = document.getElementById("email").value.trim();
//   const password = document.getElementById("password").value;

//   try {
//     // Call backend API to login
//     const response = await fetch('http://localhost:3001/api/auth/login', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ email, password })
//     });

//     const data = await response.json();

//     if (!response.ok) {
//       throw new Error(data.message || data.error || 'Login failed');
//     }

//     // Backend returns a custom token, use it to sign in with Firebase Client SDK
//     await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
//     await auth.signInWithCustomToken(data.token);
    
//     showToast("Logged in!", "success");
//     window.location.href = "../dashboard-files/dashboard.html";
//   } catch (error) {
//     console.error("Login error:", error);
    
//     // Show user-friendly error
//     let message = error.message || "Login failed. Please check your credentials.";
//     showToast(message, "error");
//   }
// }

// // comment: This function handles user login


// // Purpose: Authenticates existing users
// // Logic:
// // Prevents form refresh on submission
// // Gets email and password from form
// // Sets session persistence (user stays logged in)
// // Attempts to sign in with Firebase credentials
// // Shows success message and redirects to dashboard
// // Error handling shows login errors (wrong password, user not found, etc.)



// // Logout Function
// async function logout() {
//   try {
//     await auth.signOut();
//     showToast("Logged out!");
//     window.location.href = "../index.html";
//   } catch (error) {
//     console.error("Logout error:");
//     showToast("error");
//   }
// }
// // comment: This function handles user logout
// // Purpose: Signs out the current user
// // Logic:
// // Calls Firebase signOut() to end user session
// // Shows success message
// // Redirects to home page (index.html)
// // Error handling for logout failures




// // Auth State Monitor
// firebase.auth().onAuthStateChanged((user) => {
//   const status = document.getElementById("userInfo");
//   if (user) {
//     if (status) status.innerText = `Logged in as: ${user.email}`;
//   } else {
//     if (window.location.pathname.includes("dashboard")) {
//       window.location.href = "../index.html";
//     }
//   }
// });

// // comment: This function monitors user authentication state
// // Purpose: Monitors user login status across the app
// // Logic:
// // Listens for auth state changes (login/logout)
// // If user is logged in: updates status display (if element exists)
// // If user is logged out: redirects from dashboard to home page
// // Protects dashboard from unauthorized access



// // Add Event Listener for Form Submission
// document.addEventListener("DOMContentLoaded", () => {
//   // Signup form event listener
//   const signupForm = document.getElementById("signupForm");
//   if (signupForm) {
//     signupForm.addEventListener("submit", register);
//     console.log("Signup form event listener attached successfully");
//   } else {
//     console.log("Signup form not found (this is normal on login page)");
//   }

//   // Login form event listener
//   const loginForm = document.getElementById("loginForm");
//   if (loginForm) {
//     loginForm.addEventListener("submit", login);
//     console.log("Login form event listener attached successfully");
//   } else {
//     console.log("Login form not found (this is normal on signup page)");
//   }

//   const forgotPasswordLink = document.getElementById("forgotPassword");
//   if (forgotPasswordLink) {
//     forgotPasswordLink.addEventListener("click", (e) => {
//       e.preventDefault();
//       forgotPassword();
//     });
//   }
// });
// // comment: This code sets up event listeners for form submissions
// // Purpose: Connects HTML forms to JavaScript functions
// // Logic:
// // Waits for page to fully load (DOMContentLoaded)
// // Finds signup form and attaches submit event to register() function
// // Finds login form and attaches submit event to login() function
// // Finds forgot password link and attaches click event to forgotPassword() function
// // Handles both pages gracefully (signup page won't have login form, vice versa)
// // Prevents default link behavior for forgot password



// ⚠️ Remove these lines in production — they hide all errors
// console.log = function() {};
// console.warn = function() {};
// console.error = function() {};
// console.info = function() {};

// Firebase Configuration
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

// ✅ Single source of truth for your API base URL
// Automatically uses localhost during development, Render in production
const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://cty-7cyi.onrender.com';


// Global Toast Notification System
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


// Register Function
async function register(event) {
  event.preventDefault();

  if (!navigator.onLine) {
    showToast("Sorry, you are currently offline");
    return;
  }

  const name = document.getElementById("fullName").value.trim();
  const age = document.getElementById("age").value;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  // Validation
  if (!name || !age || !email || !password || !confirmPassword) {
    showToast("Please fill all fields.");
    return;
  }

  if (password !== confirmPassword) {
    showToast("Passwords do not match.");
    return;
  }

  if (age < 4 || age > 17) {
    showToast("Age must be between 4 and 17.");
    return;
  }

  try {
    // ✅ Uses API_BASE instead of hardcoded localhost
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, age: parseInt(age) })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Registration failed');
    }

    // Sign in with the custom token returned by backend
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    const userCredential = await auth.signInWithCustomToken(data.token);
    const user = userCredential.user;

    // ✅ Uses API_BASE for welcome email too
    try {
      const emailResponse = await fetch(`${API_BASE}/send-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          displayName: name
        })
      });

      if (!emailResponse.ok) {
        console.warn('Email service returned error:', emailResponse.status);
      }
    } catch (emailError) {
      // Non-critical — don't block registration if email fails
      console.error('Failed to trigger welcome email:', emailError);
    }

    showToast("Registered and logged in!");
    setTimeout(() => {
      window.location.href = "../dashboard-files/dashboard.html";
    }, 1500);

  } catch (error) {
    console.error("Registration error:", error);
    showToast(error.message || "Registration failed. Please try again.", "error");
  }
}


// Forgot Password Function
async function forgotPassword() {
  const email = prompt("Please enter your email address to reset your password:");

  if (!email) {
    showToast("Email is required");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast("Please enter a valid email address");
    return;
  }

  try {
    // ✅ Uses API_BASE instead of hardcoded localhost
    const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Password reset failed');
    }

    showToast(data.message || "Password reset email sent!");
  } catch (error) {
    console.error("Password reset error:", error);
    showToast(error.message || "An error occurred. Please try again.", "error");
  }
}


// Login Function
async function login(event) {
  event.preventDefault();

  if (!navigator.onLine) {
    showToast("Sorry, you are currently offline");
    return;
  }

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    // ✅ Uses API_BASE instead of hardcoded localhost
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Login failed');
    }

    // Sign in with the custom token returned by backend
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    await auth.signInWithCustomToken(data.token);

    showToast("Logged in!", "success");
    window.location.href = "../dashboard-files/dashboard.html";
  } catch (error) {
    console.error("Login error:", error);
    showToast(error.message || "Login failed. Please check your credentials.", "error");
  }
}


// Logout Function
async function logout() {
  try {
    await auth.signOut();
    showToast("Logged out!");
    window.location.href = "../index.html";
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Logout failed. Please try again.", "error");
  }
}


// Auth State Monitor
firebase.auth().onAuthStateChanged((user) => {
  const status = document.getElementById("userInfo");
  if (user) {
    if (status) status.innerText = `Logged in as: ${user.email}`;
  } else {
    if (window.location.pathname.includes("dashboard")) {
      window.location.href = "../index.html";
    }
  }
});


// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", register);
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", login);
  }

  const forgotPasswordLink = document.getElementById("forgotPassword");
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      forgotPassword();
    });
  }
});