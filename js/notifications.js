// Notification Settings Toggle System
// Placeholder implementation for daily reminder preferences

// Firebase Cloud Messaging imports
import { messaging } from './firebase-config.js';
import { getToken, onMessage } from 'firebase/messaging';

// VAPID key for push notifications
const VAPID_KEY = 'BM7rPiOxnkH1BqLE5sd9Sw482s8AVS8i-ZbpefqU4wB4FOOHfUt6f3SWxjNJlDyCD2NgUHOMbFZG15cmeInirAA';

// Initialize notification toggles on page load
document.addEventListener('DOMContentLoaded', () => {
  // Select toggle elements
  const emailToggle = document.querySelector('#email-toggle');
  const pushToggle = document.querySelector('#push-toggle');
  
  // Initialize email toggle
  if (emailToggle) {
    // Check localStorage for saved state
    const emailState = localStorage.getItem('email-notifications') || 'off';
    emailToggle.checked = emailState === 'on';
    
    // Add event listener
    emailToggle.addEventListener('change', () => {
      const newState = emailToggle.checked ? 'on' : 'off';
      localStorage.setItem('email-notifications', newState);
      console.log(`Email notifications turned ${newState.toUpperCase()}`);
    });
  }
  
  // Initialize push toggle
  if (pushToggle) {
    // Check localStorage for saved state
    const pushState = localStorage.getItem('push-notifications') || 'off';
    pushToggle.checked = pushState === 'on';
    
    // Add event listener
    pushToggle.addEventListener('change', async () => {
      const newState = pushToggle.checked ? 'on' : 'off';
      localStorage.setItem('push-notifications', newState);
      console.log(`Push notifications turned ${newState.toUpperCase()}`);
      
      // Handle push notification permission when toggle is turned on
      if (newState === 'on') {
        await initNotifications();
      }
    });
  }
  
  // Initialize push notifications if toggle is already on
  const savedPushState = localStorage.getItem('push-notifications');
  if (savedPushState === 'on') {
    initNotifications();
  }
});

// Initialize browser push notifications and get FCM token
async function initNotifications() {
  try {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }
    
    // Check if permission is already granted
    if (Notification.permission !== 'granted') {
      console.log('Requesting notification permission...');
      
      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return;
      }
    }
    
    console.log('Notification permission granted');
    
    // Get FCM token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    
    if (token) {
      console.log('FCM Token:', token);
      // Token is logged to console as requested
      // TODO: Send token to backend when ready
    } else {
      console.log('No registration token available');
    }
    
    // Set up foreground message listener
    onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      
      // Optionally display alert with notification title
      if (payload.notification && payload.notification.title) {
        alert(payload.notification.title);
      }
    });
    
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
} 