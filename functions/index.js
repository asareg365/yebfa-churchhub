const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

// Define the API Key secret
const MNOTIFY_API_KEY = defineSecret("MNOTIFY_API_KEY");

// Import logic components
const { sendBirthdaySMS: processBirthdays } = require("./schedulers/birthdayScheduler");
const { retryFailedSMS } = require("./schedulers/retryScheduler");

/**
 * Daily Birthday SMS Scheduler
 * Runs at 06:00 AM Africa/Accra
 * Uses the MNOTIFY_API_KEY secret
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
 * Trigger via HTTPS request
 * Uses the MNOTIFY_API_KEY secret
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
 * Runs every 30 minutes to clean up failed deliveries
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
