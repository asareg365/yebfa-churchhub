
const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const MNOTIFY_API_KEY = defineSecret("MNOTIFY_API_KEY");
const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];

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
 * mNotify Delivery Webhook (Real-time tracking)
 * Public endpoint with native CORS handling
 */
exports.mnotifyDeliveryWebhook = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    const { message_id, status, recipient, network } = req.body;
    
    if (!message_id) return res.status(400).send("Missing message_id");

    const db = admin.firestore();
    
    try {
      // 1. Update Technical Report
      await db.collection("smsDeliveryReports").doc(message_id).set({
        status,
        recipient,
        network,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 2. Locate and Update Log
      const logQuery = await db.collectionGroup("smsLogs")
        .where("providerId", "==", message_id)
        .limit(1)
        .get();

      if (!logQuery.empty) {
        const logDoc = logQuery.docs[0];
        const statusMap = {
          "delivered": "sent",
          "undelivered": "failed",
          "expired": "failed",
          "rejected": "failed"
        };
        
        await logDoc.ref.update({
          providerStatus: status,
          status: statusMap[status.toLowerCase()] || "sent",
          network: network || "unknown",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

/**
 * SYSTEM ADMIN: Platform Stats
 */
exports.getSystemStats = onCall(
  { region: "us-central1" },
  async (request) => {
    const userEmail = request.auth?.token?.email?.toLowerCase() || "";
    if (!request.auth || !SUPER_ADMINS.includes(userEmail)) {
      throw new HttpsError("permission-denied", "Unauthorized system access.");
    }

    const db = admin.firestore();
    
    try {
      const churchesSnap = await db.collection("churches").get();
      const walletsSnap = await db.collection("smsWallets").get();
      const ledgerSnap = await db.collection("smsLedger").where("status", "==", "SENT").get();
      const failedSnap = await db.collection("smsLedger").where("status", "==", "FAILED").get();

      let totalRevenue = 0;
      const topSpenders = [];

      // Calculate Revenue from all top-ups
      const walletsData = walletsSnap.docs.map(doc => {
        const data = doc.data();
        totalRevenue += Number(data.totalTopups || 0);
        return {
          id: doc.id,
          balance: data.balance || 0,
          spent: data.totalSpent || 0
        };
      });

      // Prepare Top Spenders (Sort by spent credits)
      const sortedWallets = [...walletsData].sort((a, b) => b.spent - a.spent).slice(0, 5);
      
      for (const sw of sortedWallets) {
        const church = churchesSnap.docs.find(c => c.id === sw.id);
        topSpenders.push({
          id: sw.id,
          name: church ? church.data().name : "Unknown",
          sent: sw.spent,
          balance: sw.balance
        });
      }

      return {
        totalTenants: churchesSnap.size,
        activeTenants: churchesSnap.docs.filter(c => c.data().sms?.subscriptionStatus === 'active').length,
        totalSent: ledgerSnap.size,
        totalFailed: failedSnap.size,
        totalRevenue: totalRevenue, // All-time in GH₵
        topSpenders
      };
    } catch (error) {
      throw new HttpsError("internal", error.message);
    }
  }
);

/**
 * SYSTEM ADMIN: Update Tenant Status
 */
exports.updateChurchStatus = onCall(
  { region: "us-central1" },
  async (request) => {
    const userEmail = request.auth?.token?.email?.toLowerCase() || "";
    if (!request.auth || !SUPER_ADMINS.includes(userEmail)) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }

    const { churchId, status } = request.data;
    const db = admin.firestore();

    try {
      await db.collection("churches").doc(churchId).update({
        "sms.subscriptionStatus": status,
        "sms.approved": status === 'active',
        status: status === 'active' ? 'Approved' : 'Suspended'
      });
      return { success: true };
    } catch (error) {
      throw new HttpsError("internal", error.message);
    }
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
 * ADMINISTRATIVE INTERFACES
 */
exports.adminTopUpWallet = onCall(
  { region: "us-central1" },
  async (request) => {
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
