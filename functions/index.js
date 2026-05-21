const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

// Define the API Key secret - strictly using Secret Manager
const MNOTIFY_API_KEY = defineSecret("MNOTIFY_API_KEY");

// Import logic components
const { sendBirthdaySMS: processBirthdays } = require("./schedulers/birthdayScheduler");
const { retryFailedSMS } = require("./schedulers/retryScheduler");

/**
 * Callable function to send SMS securely.
 * Uses the secret value directly via .value()
 */
exports.sendSMS = onCall(
  {
    secrets: [MNOTIFY_API_KEY],
  },
  async (request) => {
    const { phone, message, senderId } = request.data;
    const axios = require("axios");
    
    // Access the secret value
    const apiKey = MNOTIFY_API_KEY.value();
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;

    try {
      console.log(`Cloud Function sending SMS...`);
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
      console.error("Cloud sendSMS Error:", error.message);
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
      console.log("Starting manual birthday SMS test...");
      const result = await processBirthdays(MNOTIFY_API_KEY.value());
      res.status(200).send({
        success: true,
        message: "Birthday test execution completed.",
        details: result
      });
    } catch (error) {
      console.error("Test function error:", error);
      res.status(500).send({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Failed SMS Retry Engine
 */
exports.retryFailedSMS = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "Africa/Accra",
    secrets: [MNOTIFY_API_KEY],
  },
  async (event) => {
    return retryFailedSMS(MNOTIFY_API_KEY.value());
  }
);
