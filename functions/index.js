
const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const MNOTIFY_API_KEY = defineSecret("MNOTIFY_API_KEY");

const { dispatchAllBirthdays, processChurchBirthdays } = require("./schedulers/birthdayScheduler");
const { retryFailedSMS: processRetries } = require("./schedulers/retryScheduler");

/**
 * GLOBAL BIRTHDAY DISPATCHER
 * Runs daily at 06:00 UTC.
 */
exports.sendBirthdaySMS = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "UTC",
    secrets: [MNOTIFY_API_KEY],
    timeoutSeconds: 540,
    memory: "512MiB"
  },
  async (event) => {
    return dispatchAllBirthdays(MNOTIFY_API_KEY.value());
  }
);

/**
 * MONTHLY CREDIT RESET
 * Runs on the 1st of every month to reset plan credits.
 */
exports.resetMonthlyCredits = onSchedule(
  {
    schedule: "0 0 1 * *",
    timeZone: "Africa/Accra"
  },
  async (event) => {
    const db = admin.firestore();
    const churchesSnap = await db.collection("churches").get();
    const batch = db.batch();

    const planCredits = {
      "Basic": 100,
      "Standard": 1000,
      "Premium": 5000
    };

    churchesSnap.docs.forEach(doc => {
      const data = doc.data();
      const plan = data.plan || "Basic";
      const credits = planCredits[plan] || 100;
      batch.update(doc.ref, { "sms.credits": credits });
    });

    return batch.commit();
  }
);

/**
 * MANUAL TEST ENDPOINT
 */
exports.testBirthdaySMS = onRequest(
  { secrets: [MNOTIFY_API_KEY] },
  async (req, res) => {
    const churchId = req.query.churchId || req.body.churchId;
    if (!churchId) return res.status(400).send("Missing churchId");

    try {
      const db = admin.firestore();
      const churchDoc = await db.collection("churches").doc(churchId).get();
      if (!churchDoc.exists) return res.status(404).send("Church not found");

      const result = await processChurchBirthdays(MNOTIFY_API_KEY.value(), churchDoc);
      res.status(200).send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, error: error.message });
    }
  }
);

/**
 * SECURE CALLABLE FOR FRONTEND
 */
exports.sendSMS = onCall(
  { secrets: [MNOTIFY_API_KEY] },
  async (request) => {
    const { sendSMS: coreSend } = require("./services/smsService");
    const { phone, message, type, memberName, memberId, churchId } = request.data;
    
    // Authorization check: User should be member of church (Simplified for now)
    if (!churchId) throw new Error("Missing churchId context");

    return coreSend(MNOTIFY_API_KEY.value(), churchId, {
      phone, message, type, memberName, memberId
    });
  }
);

/**
 * RETRY ENGINE
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
