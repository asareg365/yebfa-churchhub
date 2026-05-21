const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Define the API Key secret - strictly using Secret Manager
const MNOTIFY_API_KEY = defineSecret("MNOTIFY_API_KEY");

// Import logic components
const { sendBirthdaySMS: processBirthdays } = require("./schedulers/birthdayScheduler");
const { retryFailedSMS: processRetries } = require("./schedulers/retryScheduler");

/**
 * Callable function to send SMS securely.
 * Invoked by the frontend using httpsCallable.
 */
exports.sendSMS = onCall(
  {
    secrets: [MNOTIFY_API_KEY],
  },
  async (request) => {
    const { phone, message, senderId } = request.data;
    const axios = require("axios");
    
    // Access the secret value from Secret Manager
    const apiKey = MNOTIFY_API_KEY.value();
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;

    try {
      const response = await axios.post(url, {
        recipient: [phone],
        sender: senderId || "ChurchHub",
        message: message,
        is_schedule: false
      }, { timeout: 10000 });

      return {
        success: response.status === 200,
        data: response.data
      };
    } catch (error) {
      console.error("sendSMS Error:", error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }
);

/**
 * Daily Birthday SMS Scheduler
 * Executes at 6:00 AM Africa/Accra time.
 */
exports.sendBirthdaySMS = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "Africa/Accra",
    secrets: [MNOTIFY_API_KEY],
  },
  async (event) => {
    return processBirthdays(MNOTIFY_API_KEY.value());
  }
);

/**
 * Manual Trigger for testing Birthday SMS
 */
exports.testBirthdaySMS = onRequest(
  {
    secrets: [MNOTIFY_API_KEY],
  },
  async (req, res) => {
    try {
      const result = await processBirthdays(MNOTIFY_API_KEY.value());
      res.status(200).send({
        success: true,
        message: "Manual birthday test execution completed.",
        details: result
      });
    } catch (error) {
      console.error("testBirthdaySMS error:", error);
      res.status(500).send({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Failed SMS Retry Engine
 * Runs every 30 minutes to deliver failed messages.
 */
exports.retryFailedSMS = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "Africa/Accra",
    secrets: [MNOTIFY_API_KEY],
  },
  async (event) => {
    return processRetries(MNOTIFY_API_KEY.value());
  }
);
