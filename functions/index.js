const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { CloudSchedulerClient } = require("@google-cloud/scheduler");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const MNOTIFY_API_KEY = defineSecret("MNOTIFY_API_KEY");
const scheduler = new CloudSchedulerClient();

// Import logic components
const { sendBirthdaySMS: processBirthdays } = require("./schedulers/birthdayScheduler");
const { retryFailedSMS: processRetries } = require("./schedulers/retryScheduler");

/**
 * Per-Church Birthday Trigger (HTTP)
 * Designed to be called by a Cloud Scheduler job specific to a church.
 */
exports.sendBirthdaySMS = onRequest(
  {
    secrets: [MNOTIFY_API_KEY],
  },
  async (req, res) => {
    const churchId = req.body?.churchId || req.query?.churchId;

    if (!churchId) {
      return res.status(400).send({ success: false, error: "Missing churchId in payload" });
    }

    try {
      const result = await processBirthdays(MNOTIFY_API_KEY.value(), churchId);
      res.status(200).send(result);
    } catch (error) {
      console.error(`Error processing birthdays for ${churchId}:`, error);
      res.status(500).send({ success: false, error: error.message });
    }
  }
);

/**
 * Automate Cloud Scheduler Creation
 * Triggers when a new church is registered.
 */
exports.onChurchCreated = onDocumentCreated(
  "/churches/{churchId}",
  async (event) => {
    const churchId = event.params.churchId;
    const projectId = process.env.GCLOUD_PROJECT;
    const location = "us-central1"; // Default location, adjust if necessary
    
    // Construct the URL for the trigger function
    // Note: In production, you'd use the actual deployed URL
    const functionUrl = `https://${location}-${projectId}.cloudfunctions.net/sendBirthdaySMS`;

    const parent = scheduler.locationPath(projectId, location);
    const jobName = `church-${churchId}-birthday-job`;

    const job = {
      name: `${parent}/jobs/${jobName}`,
      schedule: "0 6 * * *", // 6:00 AM daily
      timeZone: "Africa/Accra",
      httpTarget: {
        uri: functionUrl,
        httpMethod: "POST",
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(JSON.stringify({ churchId })).toString("base64"),
      },
    };

    try {
      await scheduler.createJob({ parent, job });
      console.log(`🚀 Created Cloud Scheduler job for church: ${churchId}`);
    } catch (error) {
      console.error(`❌ Failed to create scheduler for ${churchId}:`, error.message);
    }
  }
);

/**
 * Secure Callable for manual Frontend SMS sends
 */
exports.sendSMS = onCall(
  {
    secrets: [MNOTIFY_API_KEY],
  },
  async (request) => {
    const { phone, message, senderId } = request.data;
    const axios = require("axios");
    const apiKey = MNOTIFY_API_KEY.value();
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;

    try {
      const response = await axios.post(url, {
        recipient: [phone],
        sender: senderId || "YEBFA",
        message: message,
        is_schedule: false
      }, { timeout: 10000 });

      return {
        success: response.status === 200,
        data: response.data
      };
    } catch (error) {
      console.error("sendSMS Error:", error.message);
      return { success: false, error: error.message };
    }
  }
);

/**
 * Manual Trigger for testing specific church birthdays
 */
exports.testBirthdaySMS = onRequest(
  {
    secrets: [MNOTIFY_API_KEY],
  },
  async (req, res) => {
    const churchId = req.query.churchId;
    if (!churchId) return res.status(400).send("Provide ?churchId=");

    try {
      const result = await processBirthdays(MNOTIFY_API_KEY.value(), churchId);
      res.status(200).send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, error: error.message });
    }
  }
);

/**
 * Failed SMS Retry Engine (Legacy Global Scheduler)
 */
exports.retryFailedSMS = require("firebase-functions/v2/scheduler").onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "Africa/Accra",
    secrets: [MNOTIFY_API_KEY],
  },
  async (event) => {
    return processRetries(MNOTIFY_API_KEY.value());
  }
);
