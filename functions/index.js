const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
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
const { retryFailedSMS } = require("./schedulers/retryScheduler");
const { processSMSQueueItem, queueSMS, creditWallet } = require("./services/smsService");

/**
 * MISSION CRITICAL WORKER (Initial)
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
    
    let key;
    try {
      key = MNOTIFY_API_KEY.value();
    } catch (e) {
      console.error("MNOTIFY_API_KEY Secret not configured.");
      return null;
    }
    
    return processSMSQueueItem(key, event.params.messageId, data);
  }
);

/**
 * MISSION CRITICAL WORKER (Retry)
 */
exports.onSmsRetryTriggered = onDocumentUpdated(
  {
    region: "us-central1",
    document: "smsQueue/{messageId}",
    secrets: [MNOTIFY_API_KEY]
  },
  async (event) => {
    const data = event.data.after.data();
    const previousData = event.data.before.data();
    
    // Only process if status changed TO queued
    if (data.status === "queued" && previousData.status !== "queued") {
      let key;
      try {
        key = MNOTIFY_API_KEY.value();
      } catch (e) { return null; }
      
      return processSMSQueueItem(key, event.params.messageId, data);
    }
    return null;
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
        return res.status(200).send("Log record not found (Ignored)");
      }

      const logDoc = logQuery.docs[0];
      const normalizedStatus = (status || "").toLowerCase();
      
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
 * ADMIN: System Stats & Organization List (FIX OPTION 1 - Standardized Callable)
 */
exports.getSystemStats = onCall(
  { region: "us-central1" },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required");
      }

      const email = request.auth.token.email?.toLowerCase();
      if (!SUPER_ADMINS.includes(email)) {
        throw new HttpsError("permission-denied", "Unauthorized");
      }

      const db = admin.firestore();

      // Parallel fetch for high performance
      const [churchesSnap, walletsSnap] = await Promise.all([
        db.collection("churches").get(),
        db.collection("smsWallets").get()
      ]);

      const walletMap = new Map();
      walletsSnap.docs.forEach(doc => {
        walletMap.set(doc.id, doc.data());
      });

      let totalRevenue = 0;
      let totalSent = 0;
      let totalFailed = 0;

      const churchList = churchesSnap.docs.map(doc => {
        const data = doc.data();
        const wallet = walletMap.get(doc.id) || { balance: 0, totalTopups: 0, totalSpent: 0 };
        
        const sent = Number(data.sms?.stats?.sent || wallet.totalSpent || 0);
        const failed = Number(data.sms?.stats?.failed || 0);
        const revenue = Number(wallet.totalTopups || 0);

        totalRevenue += revenue;
        totalSent += sent;
        totalFailed += failed;

        return {
          id: doc.id,
          name: data.name || "Unnamed Ministry",
          slug: data.slug || doc.id,
          plan: data.plan || "Starter",
          adminEmails: data.adminEmails || [],
          registeredAt: data.registeredAt || null,
          sms: {
            credits: Number(data.sms?.credits ?? wallet.balance ?? 0),
            subscriptionStatus: data.sms?.subscriptionStatus || 'pending',
            stats: { sent, failed }
          }
        };
      });

      return {
        churches: churchList.sort((a, b) => {
          const getSec = (v) => v?.seconds || (v ? new Date(v).getTime() / 1000 : 0);
          return getSec(b.registeredAt) - getSec(a.registeredAt);
        }),
        totalTenants: churchesSnap.size,
        activeTenants: churchList.filter(c => c.sms?.subscriptionStatus === 'active').length,
        totalRevenue,
        totalSent,
        totalFailed,
        topSpenders: churchList
          .sort((a, b) => Number(b.sms?.stats?.sent || 0) - Number(a.sms?.stats?.sent || 0))
          .slice(0, 5)
          .map(c => ({
            name: c.name,
            sent: c.sms?.stats?.sent || 0,
            balance: c.sms?.credits || 0
          }))
      };
    } catch (error) {
      console.error("getSystemStats engine failure:", error);
      throw new HttpsError("internal", error.message || "Stats aggregation failed");
    }
  }
);

exports.updateChurchStatus = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email?.toLowerCase())) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }
    const { churchId, status } = request.data;
    const isApproved = status === 'active';
    
    try {
      await admin.firestore().collection("churches").doc(churchId).update({
        "sms.subscriptionStatus": status,
        "sms.approved": isApproved,
        "sms.status": isApproved ? 'Approved' : 'Suspended',
        "sms.enabled": isApproved,
        status: isApproved ? 'Approved' : 'Suspended',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) { throw new HttpsError("internal", error.message); }
  }
);

exports.updateOrganization = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email?.toLowerCase())) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }
    
    const { churchId, name, slug, adminEmails, plan } = request.data;
    if (!churchId) throw new HttpsError("invalid-argument", "Missing churchId");

    try {
      await admin.firestore().collection("churches").doc(churchId).update({
        name,
        slug,
        adminEmails: adminEmails || [],
        plan: plan || 'Basic',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) { throw new HttpsError("internal", error.message); }
  }
);

exports.adminTopUpWallet = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email?.toLowerCase())) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }
    const { churchId, amount } = request.data;
    try { return await creditWallet(churchId, amount, "admin_manual", request.auth.token.email); }
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
    let key;
    try { key = MNOTIFY_API_KEY.value(); } catch (e) { return null; }
    await dispatchAllBirthdays(key);
    await processVisitorFollowups(key);
    await processEventReminders(key);
    return null;
  }
);

exports.runRetryCycle = onSchedule(
  { schedule: "every 5 minutes", region: "us-central1", secrets: [MNOTIFY_API_KEY] },
  async () => {
    let key;
    try { key = MNOTIFY_API_KEY.value(); } catch (e) { return null; }
    await retryFailedSMS(key);
    return null;
  }
);