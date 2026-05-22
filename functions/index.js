
const { onCall, HttpsError } = require("firebase-functions/v2/https");
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
const { processSMSQueueItem, queueSMS, creditWallet, getPlatformStats } = require("./services/smsService");

/**
 * SMS QUEUE DISPATCHER (Main Engine)
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
 * ADMIN CALLABLES
 */
exports.getSystemStats = onCall(async (request) => {
  const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
  if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email.toLowerCase())) {
    throw new HttpsError("permission-denied", "Unauthorized access to system stats");
  }
  return getPlatformStats();
});

exports.adminTopUpWallet = onCall(async (request) => {
  const { churchId, amount } = request.data;
  const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
  
  if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email.toLowerCase())) {
    throw new HttpsError("permission-denied", "Only system admins can top up wallets");
  }

  await creditWallet(churchId, amount, `admin_manual_topup`, request.auth.token.email);
  return { success: true };
});

exports.updateChurchStatus = onCall(async (request) => {
  const { churchId, status } = request.data;
  const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
  
  if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email.toLowerCase())) {
    throw new HttpsError("permission-denied", "Only system admins can manage status");
  }

  const db = admin.firestore();
  await db.collection("churches").doc(churchId).update({
    "sms.subscriptionStatus": status,
    "sms.approved": status === "active",
    "sms.enabled": status === "active"
  });

  return { success: true };
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
