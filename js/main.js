const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Resend API configuration
const RESEND_API_KEY = 'YOUR_RESEND_API_KEY'; // Replace with your actual API key
const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_EMAIL = 'noreply@yourdomain.com'; // Replace with your verified domain

// Daily email notification function (runs every day at 9 AM)
exports.sendDailyEmailNotifications = functions.pubsub
  .schedule('0 9 * * *') // Cron expression: every day at 9:00 AM
  .timeZone('America/New_York') // Adjust timezone as needed
  .onRun(async (context) => {
    try {
      console.log('Starting daily email notification process...');
      
      // Get all users with email notifications enabled
      const usersSnapshot = await db.collection('users')
        .where('emailNotifications', '==', true)
        .get();
      
      if (usersSnapshot.empty) {
        console.log('No users with email notifications enabled found.');
        return null;
      }
      
      console.log(`Found ${usersSnapshot.size} users with email notifications enabled.`);
      
      // Process each user
      const emailPromises = usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        try {
          // Generate personalized email content based on user's age group
          const emailContent = generateEmailContent(userData);
          
          // Send email via Resend API
          await sendEmailViaResend({
            to: userData.email,
            subject: emailContent.subject,
            html: emailContent.html,
            userName: userData.fullName
          });
          
          console.log(`Email sent successfully to ${userData.email}`);
          
          // Log the email send in Firestore for tracking
          await db.collection('emailLogs').add({
            userId: userId,
            userEmail: userData.email,
            emailType: 'daily_notification',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'sent'
          });
          
        } catch (error) {
          console.error(`Failed to send email to ${userData.email}:`, error);
          
          // Log the error in Firestore
          await db.collection('emailLogs').add({
            userId: userId,
            userEmail: userData.email,
            emailType: 'daily_notification',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'failed',
            error: error.message
          });
        }
      });
      
      // Wait for all emails to be processed
      await Promise.all(emailPromises);
      
      console.log('Daily email notification process completed.');
      return null;
      
    } catch (error) {
      console.error('Error in daily email notification function:', error);
      throw error;
    }
  });

// Function to send email via Resend API
async function sendEmailViaResend({ to, subject, html, userName }) {
  try {
    const response = await axios.post(RESEND_API_URL, {
      from: FROM_EMAIL,
      to: to,
      subject: subject,
      html: html
    }, {
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Resend API response for ${to}:`, response.data);
    return response.data;
    
  } catch (error) {
    console.error(`Resend API error for ${to}:`, error.response?.data || error.message);
    throw error;
  }
}

// Function to generate personalized email content
function generateEmailContent(userData) {
  const age = userData.age || 10;
  const userName = userData.fullName || 'Friend';
  
  // Determine age group and content
  let verse, moral, subject;
  
  if (age >= 4 && age <= 6) {
    verse = "Be kind to one another – Ephesians 4:32";
    moral = "Always share your toys and help others.";
    subject = "🌟 Your Daily Bible Verse - Be Kind!";
  } else if (age >= 7 && age <= 10) {
    verse = "I can do all things through Christ who strengthens me – Philippians 4:13";
    moral = "Believe in yourself and trust in God's strength.";
    subject = "💪 Your Daily Bible Verse - You Can Do It!";
  } else if (age >= 11 && age <= 13) {
    verse = "Trust in the Lord with all your heart – Proverbs 3:5";
    moral = "Make good choices and trust God to guide you.";
    subject = "🤝 Your Daily Bible Verse - Trust God!";
  } else {
    verse = "For I know the plans I have for you, declares the Lord – Jeremiah 29:11";
    moral = "God has amazing plans for your future. Stay faithful!";
    subject = "🎯 Your Daily Bible Verse - God's Plans!";
  }
  
  // Create HTML email template
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Daily Bible Verse</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 20px; border-radius: 10px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .verse { font-size: 18px; font-style: italic; color: #2E7D32; margin: 15px 0; }
        .moral { background: #E8F5E8; padding: 15px; border-radius: 8px; border-left: 4px solid #4CAF50; }
        .footer { text-align: center; color: #666; font-size: 14px; margin-top: 20px; }
        .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📖 Catch Them Young</h1>
          <p>Good morning, ${userName}! Here's your daily Bible verse and moral lesson.</p>
        </div>
        
        <div class="content">
          <h2>📜 Today's Bible Verse</h2>
          <div class="verse">"${verse}"</div>
          
          <h2>💖 Moral of the Day</h2>
          <div class="moral">
            <strong>${moral}</strong>
          </div>
          
          <p style="text-align: center; margin: 20px 0;">
            <a href="https://your-app-domain.com/dashboard" class="button">Visit Your Dashboard</a>
          </p>
        </div>
        
        <div class="footer">
          <p>Keep up your amazing streak of ${userData.streakCount || 0} days! 🔥</p>
          <p>To unsubscribe from daily emails, visit your notification settings.</p>
          <p>&copy; 2024 Catch Them Young. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return { subject, html };
}

// Optional: Function to update user's email notification preference
exports.updateEmailPreference = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const userId = context.auth.uid;
  const { emailEnabled } = data;
  
  try {
    await db.collection('users').doc(userId).update({
      emailNotifications: emailEnabled,
      emailPreferenceUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Email preference updated for user ${userId}: ${emailEnabled}`);
    return { success: true };
    
  } catch (error) {
    console.error('Error updating email preference:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update email preference');
  }
}); 