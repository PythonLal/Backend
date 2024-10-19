// firebaseService.js

require('dotenv').config()

const cron = require('node-cron');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();

async function saveUserToken(token) {
  try {
    const tokenDoc = await db.collection('tokens').doc(token).get();

    if (tokenDoc.exists) {
      console.log(`Token ${token} already exists in the database.`);
      return;
    }

    // Use set with token as the document ID (doc(token)) to avoid duplicates
    const docRef = db.collection('tokens').doc(token);
    await docRef.set({ token });
    console.log(`Token ${token} saved successfully`);
  } catch (error) {
    console.error('Error saving token:', error);
    throw error;
  }
}

async function getUserTokens() {
  try {
    const tokensSnapshot = await db.collection('tokens').get();
    const tokens = [];
    tokensSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.token && !tokens.includes(data.token)) {  // Avoid duplicates
        tokens.push(data.token);
      }
    });
    console.log('Retrieved tokens:', tokens);
    return tokens;
  } catch (error) {
    console.error('Error retrieving tokens:', error);
    throw error;
  }
}

async function sendNotificationToUsers(payload) {
  try {
    const tokens = await getUserTokens();
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      throw new Error('No valid tokens available to send notifications.');
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens: uniqueTokens,
      notification: payload.notification,
    });

    console.log('Notification sent:', response);
    return response;
  } catch (error) {
    console.error('Error sending notifications:', error);
    throw error;
  }
}

// Schedule a notification to be sent at a specified time
async function scheduleNotification(title, message, time, link, image) {
  // Validate time data before proceeding
  if (!time || typeof time.minute !== 'number' || typeof time.hour !== 'number') {
    console.error('Invalid time data provided:', time);
    throw new Error('Invalid time data');
  }

  const payload = {
    notification: {
      title,
      body: message,
      ...(link && { click_action: link }),
      ...(image && { image })
    }
  };

  // Create cron format string
  const cronTime = `${time.minute} ${time.hour} * * *`; 

  // Schedule the task with proper error handling
  try {
    cron.schedule(cronTime, () => {
      console.log(`Sending scheduled notification at ${time.hour}:${time.minute}`);
      sendNotificationToUsers(payload);
    });
    console.log('Notification scheduled successfully for:', cronTime);
  } catch (error) {
    console.error('Error scheduling notification:', error);
    throw error;
  }
}

module.exports = {
  saveUserToken,
  getUserTokens,
  sendNotificationToUsers,
  scheduleNotification,
};