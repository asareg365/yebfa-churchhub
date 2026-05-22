
const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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
const { processSMSQueueItem, queueSMS } = require("./services/smsService");

/**
 * SMS QUEUE DISPATCHER (Main Engine)
 * Triggered whenever a new message is added to the queue.
 */
exports.onSmsQueued = onDocumentCreated(
  {
    document: "smsQueue/{messageId}",
    secrets: [MNOTIFY_API_KEY]
  },
  async (event) => {
    return processSMSQueueItem(MNOTIFY_API_KEY.value(), event.params.messageId, event.data.data());
  }
);

/**
 * GLOBAL AUTOMATION DISPATCHERS
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
 * Checks every 10 mins for scheduled bulk messages.
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
    
    for (const doc of churchesSnap.docs) {
      const data = doc.data();
      const plan = data.plan || "Basic";
      const planCredits = { "Basic": 100, "Standard": 1000, "Premium": 5000 };
      const credits = planCredits[plan] || 100;
      
      await doc.ref.update({
        "sms.credits": credits,
        "sms.resetAt": admin.firestore.FieldValue.serverTimestamp()
      });
    }
    return null;
  }
);

/**
 * SECURE CALLABLE FOR FRONTEND
 * Bridges frontend requests to the centralized Queue.
 */
exports.sendSMS = onCall(async (request) => {
  const { phone, message, type, memberName, memberId, churchId } = request.data;
  
  if (!churchId) throw new Error("Missing churchId context");

  return queueSMS(churchId, {
    phone, message, type, memberName, memberId
  });
});

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
