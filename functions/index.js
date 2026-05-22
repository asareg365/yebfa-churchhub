
const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
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
const { processSMSQueueItem, queueSMS, creditWallet, getPlatformStats, handleMNotifyWebhook } = require("./services/smsService");

/**
 * SMS QUEUE DISPATCHER
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
 * MNOTIFY WEBHOOK
 * Receives delivery updates from provider.
 */
exports.mnotifyDeliveryWebhook = onRequest(async (req, res) => {
  return handleMNotifyWebhook(req, res);
});

/**
 * ADMIN CALLABLES
 */
exports.getSystemStats = onCall(async (request) => {
  const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
  const userEmail = request.auth?.token?.email?.toLowerCase() || "";
  
  if (!request.auth || !SUPER_ADMINS.includes(userEmail)) {
    throw new HttpsError("permission-denied", "Unauthorized access to system stats");
  }

  try {
    const stats = await getPlatformStats();
    return stats;
  } catch (error) {
    console.error("System Stats Error:", error);
    throw new HttpsError("internal", error.message || "Failed to retrieve platform stats");
  }
});

exports.adminTopUpWallet = onCall(async (request) => {
  const { churchId, amount } = request.data;
  const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
  const userEmail = request.auth?.token?.email?.toLowerCase() || "";
  
  if (!request.auth || !SUPER_ADMINS.includes(userEmail)) {
    throw new HttpsError("permission-denied", "Only system admins can top up wallets");
  }

  try {
    await creditWallet(churchId, amount, `admin_manual_topup`, userEmail);
    return { success: true };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

exports.updateChurchStatus = onCall(async (request) => {
  const { churchId, status } = request.data;
  const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
  const userEmail = request.auth?.token?.email?.toLowerCase() || "";
  
  if (!request.auth || !SUPER_ADMINS.includes(userEmail)) {
    throw new HttpsError("permission-denied", "Only system admins can manage status");
  }

  try {
    const db = admin.firestore();
    await db.collection("churches").doc(churchId).update({
      "sms.subscriptionStatus": status,
      "sms.approved": status === "active",
      "sms.enabled": status === "active"
    });
    return { success: true };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

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
 * SECURE CALLABLE FOR FRONTEND
 */
exports.sendSMS = onCall(async (request) => {
  const { phone, message, type, memberName, memberId, churchId } = request.data;
  if (!churchId) throw new HttpsError("invalid-argument", "Missing churchId context");
  
  try {
    return await queueSMS(churchId, {
      phone, message, type, memberName, memberId
    });
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
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
