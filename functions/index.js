const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const MNOTIFY_API_KEY = defineSecret("MNOTIFY_API_KEY");

// Import schedulers
const { sendBirthdaySMS } = require("./schedulers/birthdayScheduler");
const { retryFailedSMS } = require("./schedulers/retryScheduler");

/**
 * Daily Birthday SMS Scheduler
 * Runs at 06:00 AM Africa/Accra
 */
exports.birthdayEngine = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "Africa/Accra",
    secrets: [MNOTIFY_API_KEY],
  },
  async (event) => {
    return sendBirthdaySMS(MNOTIFY_API_KEY.value());
  }
);

/**
 * Failed SMS Retry Engine
 * Runs every 30 minutes
 */
exports.retryEngine = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "Africa/Accra",
    secrets: [MNOTIFY_API_KEY],
  },
  async (event) => {
    return retryFailedSMS(MNOTIFY_API_KEY.value());
  }
);
