
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
 * mNotify Delivery Webhook (Handset Confirmation)
 */
exports.mnotifyDeliveryWebhook = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    const { message_id, status } = req.body;
    if (!message_id) return res.status(400).send("Missing message_id");
    
    const db = admin.firestore();
    try {
      const logQuery = await db.collectionGroup("smsLogs")
        .where("providerId", "==", String(message_id))
        .limit(1)
        .get();

      if (logQuery.empty) {
        console.warn(`Webhook: Provider ID ${message_id} not found.`);
        return res.status(404).send("Log record not found");
      }

      const logDoc = logQuery.docs[0];
      const normalizedStatus = (status || "").toLowerCase();
      
      // Map provider status to handset-verified 'delivered'
      const finalStatus = normalizedStatus === "delivered" ? "delivered" : "sent";

      await logDoc.ref.update({
        providerStatus: normalizedStatus,
        status: finalStatus,
        deliveredAt: finalStatus === "delivered" ? admin.firestore.FieldValue.serverTimestamp() : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Webhook: Updated message ${message_id} to ${normalizedStatus}`);
      res.status(200).send("OK");
    } catch (error) { 
      console.error("Webhook Error:", error.message);
      res.status(500).send("Internal error"); 
    }
  }
);

/**
 * ADMIN: System Stats
 */
exports.getSystemStats = onCall(
  { region: "us-central1" },
  async (request) => {
    const userEmail = request.auth?.token?.email?.toLowerCase() || "";
    if (!request.auth || !SUPER_ADMINS.includes(userEmail)) {
      throw new HttpsError("permission-denied", "Unauthorized access.");
    }

    const db = admin.firestore();
    try {
      const churchesSnap = await db.collection("churches").get();
      const walletsSnap = await db.collection("smsWallets").get();
      const ledgerSnap = await db.collection("smsLedger").where("status", "==", "SUBMITTED").limit(1000).get();

      let totalRevenue = 0;
      walletsSnap.docs.forEach(doc => {
        totalRevenue += Number(doc.data().totalTopups || 0);
      });

      return {
        totalTenants: churchesSnap.size,
        activeTenants: churchesSnap.docs.filter(c => c.data().sms?.subscriptionStatus === 'active').length,
        totalSent: ledgerSnap.size,
        totalRevenue: totalRevenue
      };
    } catch (error) { 
      throw new HttpsError("internal", error.message); 
    }
  }
);

exports.updateChurchStatus = onCall(
  { region: "us-central1" },
  async (request) => {
    const userEmail = request.auth?.token?.email?.toLowerCase() || "";
    if (!request.auth || !SUPER_ADMINS.includes(userEmail)) throw new HttpsError("permission-denied", "Unauthorized");
    const { churchId, status } = request.data;
    const isApproved = status === 'active';
    
    try {
      await admin.firestore().collection("churches").doc(churchId).update({
        "sms.subscriptionStatus": status,
        "sms.approved": isApproved,
        "sms.status": isApproved ? 'Approved' : 'Suspended',
        "sms.enabled": isApproved,
        status: isApproved ? 'Approved' : 'Suspended'
      });
      return { success: true };
    } catch (error) { throw new HttpsError("internal", error.message); }
  }
);

exports.adminTopUpWallet = onCall(
  { region: "us-central1" },
  async (request) => {
    const userEmail = request.auth?.token?.email?.toLowerCase() || "";
    if (!request.auth || !SUPER_ADMINS.includes(userEmail)) throw new HttpsError("permission-denied", "Unauthorized");
    const { churchId, amount } = request.data;
    try { return await creditWallet(churchId, amount, "admin_manual", userEmail); }
    catch (error) { throw new HttpsError("internal", error.message); }
  }
);

exports.sendSMS = onCall(
  { region: "us-central1" },
  async (request) => {
    const { phone, message, type, churchId, memberName, memberId } = request.data;
    if (!churchId) throw new HttpsError("invalid-argument", "Missing context");
    try { return await queueSMS(churchId, { phone, message, type, memberName, memberId }); }
    catch (error) { throw new HttpsError("internal", error.message); }
  }
);

exports.runDailyAutomations = onSchedule(
  { schedule: "0 6 * * *", timeZone: "Africa/Accra", region: "us-central1", secrets: [MNOTIFY_API_KEY] },
  async () => {
    const key = MNOTIFY_API_KEY.value();
    await dispatchAllBirthdays(key);
    await processVisitorFollowups(key);
    await processEventReminders(key);
    return null;
  }
);
