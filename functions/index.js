const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const MNOTIFY_API_KEY = defineSecret("MNOTIFY_API_KEY");

// Import logic components
const { dispatchAllBirthdays, processChurchBirthdays } = require("./schedulers/birthdayScheduler");
const { retryFailedSMS: processRetries } = require("./schedulers/retryScheduler");

/**
 * GLOBAL BIRTHDAY SCHEDULER (V2)
 * Runs daily at 06:00 UTC. 
 * Triggers the fanout/iteration logic for all churches.
 */
exports.sendBirthdaySMS = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "UTC",
    secrets: [MNOTIFY_API_KEY],
    timeoutSeconds: 540, // Increased for large tenant processing
    memory: "512MiB"
  },
  async (event) => {
    return dispatchAllBirthdays(MNOTIFY_API_KEY.value());
  }
);

/**
 * MANUAL TEST ENDPOINT (V2)
 * Allows developers to trigger birthday processing for a specific church ID via HTTP.
 */
exports.testBirthdaySMS = onRequest(
  {
    secrets: [MNOTIFY_API_KEY],
  },
  async (req, res) => {
    const churchId = req.query.churchId || req.body.churchId;
    if (!churchId) return res.status(400).send("Missing ?churchId= in request.");

    try {
      const db = admin.firestore();
      const churchDoc = await db.collection("churches").doc(churchId).get();
      
      if (!churchDoc.exists) {
        return res.status(404).send({ success: false, error: "Church not found" });
      }

      const result = await processChurchBirthdays(MNOTIFY_API_KEY.value(), churchDoc);
      res.status(200).send({ success: true, result });
    } catch (error) {
      console.error("testBirthdaySMS Error:", error);
      res.status(500).send({ success: false, error: error.message });
    }
  }
);

/**
 * SECURE CALLABLE FOR FRONTEND
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
 * FAILED SMS RETRY ENGINE
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
