
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
const { retryFailedSMS } = require("./schedulers/retryScheduler");
const { processSMSQueueItem, queueSMS, creditWallet } = require("./services/smsService");

/**
 * MISSION CRITICAL WORKER
 */
exports.onSmsQueued = onDocumentCreated(
  {
    region: "us-central1",
    document: "smsQueue/{messageId}",
    secrets: [MNOTIFY_API_KEY]
  },
  async (event) => {
    const data = event.data.data();
    if (data.status !== "queued") return null;
    return processSMSQueueItem(MNOTIFY_API_KEY.value(), event.params.messageId, data);
  }
);

/**
 * AUTO-RETRY ENGINE (Exponential Backoff)
 */
exports.retryFailedSmsEngine = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Africa/Accra",
    region: "us-central1",
    secrets: [MNOTIFY_API_KEY]
  },
  async (event) => {
    return retryFailedSMS(MNOTIFY_API_KEY.value());
  }
);

/**
 * RECONCILIATION & AUDIT (Nightly)
 */
exports.nightlyWalletAudit = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "Africa/Accra",
    region: "us-central1"
  },
  async (event) => {
    console.log("Nightly financial reconciliation started...");
    // Future: Implementation of re-summing ledger vs wallet balance
    return null;
  }
);

/**
 * ADMINISTRATIVE INTERFACES
 */
exports.adminTopUpWallet = onCall(
  { region: "us-central1" },
  async (request) => {
    const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
    const userEmail = request.auth?.token?.email?.toLowerCase() || "";
    
    if (!request.auth || !SUPER_ADMINS.includes(userEmail)) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }

    const { churchId, amount } = request.data;
    try {
      return await creditWallet(churchId, amount, "admin_manual", userEmail);
    } catch (error) {
      throw new HttpsError("internal", error.message);
    }
  }
);

exports.sendSMS = onCall(
  { region: "us-central1" },
  async (request) => {
    const { phone, message, type, churchId } = request.data;
    if (!churchId) throw new HttpsError("invalid-argument", "Missing church context");
    
    try {
      return await queueSMS(churchId, { phone, message, type });
    } catch (error) {
      throw new HttpsError("internal", error.message);
    }
  }
);

/**
 * DAILY AUTOMATIONS
 */
exports.runDailyAutomations = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "Africa/Accra",
    region: "us-central1",
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
