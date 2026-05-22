
const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const MNOTIFY_API_KEY = defineSecret("MNOTIFY_API_KEY");

const { dispatchAllBirthdays } = require("./schedulers/birthdayScheduler");
const { processVisitorFollowups } = require("./schedulers/visitorScheduler");
const { processEventReminders } = require("./schedulers/eventScheduler");
const { processScheduledCampaigns } = require("./schedulers/campaignScheduler");
const { retryFailedSMS: processRetries } = require("./schedulers/retryScheduler");

/**
 * GLOBAL AUTOMATION DISPATCHERS
 * Runs daily at 06:00 UTC.
 */
exports.runDailyAutomations = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "UTC",
    secrets: [MNOTIFY_API_KEY],
    timeoutSeconds: 540,
    memory: "512MiB"
  },
  async (event) => {
    const key = MNOTIFY_API_KEY.value();
    await dispatchAllBirthdays(key);
    await processVisitorFollowups(key);
    await processEventReminders(key);
    return null;
  }
);

/**
 * CAMPAIGN PROCESSOR
 * Runs every 10 minutes to process scheduled announcements.
 */
exports.processSmsCampaigns = onSchedule(
  {
    schedule: "*/10 * * * *",
    timeZone: "UTC",
    secrets: [MNOTIFY_API_KEY]
  },
  async (event) => {
    return processScheduledCampaigns(MNOTIFY_API_KEY.value());
  }
);

/**
 * MONTHLY CREDIT RESET
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
      batch.update(doc.ref, { 
        "sms.credits": credits,
        "sms.updatedAt": admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return batch.commit();
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
