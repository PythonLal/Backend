// server.js

require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const firebaseService = require('./firebaseService');
const admin = require('firebase-admin'); // Make sure you import admin

const app = express();

app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

// Handle GET requests to the root URL
app.get('/', (req, res) => {
  res.send('Welcome to the Push Notification Service');
});

app.post('/subscribe', (req, res) => {
  const { token } = req.body;
  firebaseService.saveUserToken(token)
    .then(() => res.status(200).send('Token saved successfully'))
    .catch((error) => {
      console.error('Error saving token:', error); // Log the error
      res.status(500).send('Error saving token: ' + error);
    });
});

app.post('/sendNotification', async (req, res) => {
  const { title, message, link, image } = req.body;

  if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required fields.' });
  }

  try {
      const tokens = await firebaseService.getUserTokens();

      // Use a Set to ensure tokens are unique before sending
      const uniqueTokens = [...new Set(tokens)];
      console.log('Tokens being used to send notification:', uniqueTokens);

      if (uniqueTokens.length === 0) {
          return res.status(400).json({ error: 'No valid tokens available to send notifications.' });
      }

      const payload = {
          notification: {
              title,
              body: message,
              ...(link && { click_action: link }),
              ...(image && { image })
          }
      };
      const response = await admin.messaging().sendEachForMulticast({
          tokens: uniqueTokens,
          notification: payload.notification,
      });
      console.log('Firebase response:', response);
      res.status(200).send('Notifications sent successfully');
  } catch (error) {
      console.error('Error sending notifications:', error);
      res.status(500).send('Error sending notifications: ' + error);
  }
});

// Add a new route to schedule a notification
app.post('/scheduleNotification', async (req, res) => {
  try {
    const { title, message, scheduleTime, link, image } = req.body;

    console.log('Received schedule notification request with data:', req.body);

    if (!title || !message || !scheduleTime) {
      console.error('Missing required fields:', { title, message, scheduleTime });
      return res.status(400).json({ error: 'Title, message, and scheduleTime are required.' });
    }

    const [hour, minute] = scheduleTime.split(':').map(Number);

    // Check if the scheduleTime is valid
    if (isNaN(hour) || isNaN(minute)) {
      console.error('Invalid schedule time format:', scheduleTime);
      return res.status(400).json({ error: 'Invalid schedule time format.' });
    }

    // Prepare time object
    const time = { hour, minute };

    // Call the scheduleNotification method
    await firebaseService.scheduleNotification(title, message, time, link, image);

    res.status(200).send('Notification scheduled successfully');
  } catch (error) {
    console.error('Error scheduling notification:', error);
    res.status(500).send('Error scheduling notification: ' + error.message);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));