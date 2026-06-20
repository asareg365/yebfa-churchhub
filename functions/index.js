const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const MNOTIFY_API_KEY = defineSecret("MNOTIFY_API_KEY");
const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];

const { processSMSQueueItem, queueSMS, creditWallet, resetWallet } = require("./services/smsService");

// Schedulers
const { dispatchAllBirthdays } = require("./schedulers/birthdayScheduler");
const { processScheduledCampaigns } = require("./schedulers/campaignScheduler");
const { processEventReminders } = require("./schedulers/eventScheduler");
const { processVisitorFollowups } = require("./schedulers/visitorScheduler");
const { retryFailedSMS } = require("./schedulers/retryScheduler");

/**
 * ADMIN: System Stats Aggregation (v2 Callable)
 */
exports.getSystemStats = onCall(
  {
    region: "us-central1"
  },
  async (request) => {
    const email = request.auth?.token?.email?.toLowerCase().trim();
    if (!email || !SUPER_ADMINS.includes(email)) {
      throw new HttpsError("permission-denied", "Unauthorized access. System Administrator privileges required.");
    }

    try {
      const db = admin.firestore();
      const churchesSnap = await db.collection("churches").get();

      const churches = churchesSnap.docs.map(doc => {
        const d = doc.data();
        const sms = d.sms || {};
        
        return {
          id: doc.id,
          name: d.name || "Unnamed Ministry",
          slug: d.slug || "no-slug",
          plan: d.plan || d.subscription?.plan || "Starter",
          status: d.status || "Pending",
          registeredAt: d.registeredAt?.toDate ? d.registeredAt.toDate().toISOString() : (d.registeredAt ? String(d.registeredAt) : null),
          sms: {
            credits: Number(sms.credits || 0),
            sent: Number(sms.stats?.sent || 0),
            failed: Number(sms.stats?.failed || 0),
            totalTopups: Number(sms.totalTopups || 0),
            subscriptionStatus: sms.subscriptionStatus || "inactive"
          }
        };
      });

      let totalRevenue = 0;
      let totalSent = 0;
      let totalFailed = 0;
      let activeTenants = 0;

      churches.forEach(church => {
        totalRevenue += Number(church.sms?.totalTopups || 0);
        totalSent += Number(church.sms?.sent || 0);
        totalFailed += Number(church.sms?.failed || 0);
        if (church.sms?.subscriptionStatus === "active") {
          activeTenants++;
        }
      });

      const topSpenders = churches
        .sort((a, b) => (Number(b.sms?.sent || 0)) - (Number(a.sms?.sent || 0)))
        .slice(0, 5)
        .map(c => ({
          name: c.name,
          sent: Number(c.sms?.sent || 0),
          balance: Number(c.sms?.credits || 0)
        }));

      return {
        success: true,
        totalTenants: churches.length,
        activeTenants,
        totalRevenue,
        totalSent,
        totalFailed,
        churches,
        topSpenders
      };
    } catch (err) {
      console.error("STATS_ENGINE_FAILURE:", err);
      throw new HttpsError("internal", err.message || "Stats engine encountered an internal failure.");
    }
  }
);

/**
 * ADMIN: Initialize Wallets / Integrity Sync
 * Handles chunked batching for large platform updates.
 */
exports.initializeWallets = onCall(
  { region: "us-central1" },
  async (request) => {
    const email = request.auth?.token?.email?.toLowerCase().trim();
    if (!email || !SUPER_ADMINS.includes(email)) {
      throw new HttpsError("permission-denied", "Unauthorized access");
    }

    try {
      const db = admin.firestore();
      const churchesSnap = await db.collection("churches").get();
      
      const chunks = [];
      const CHUNK_SIZE = 450;
      
      for (let i = 0; i < churchesSnap.docs.length; i += CHUNK_SIZE) {
        chunks.push(churchesSnap.docs.slice(i, i + CHUNK_SIZE));
      }

      let updatedTotal = 0;

      for (const chunk of chunks) {
        const batch = db.batch();
        let chunkUpdates = 0;

        chunk.forEach(churchDoc => {
          const data = churchDoc.data();
          if (!data.sms) {
            batch.set(churchDoc.ref, {
              sms: {
                credits: 0,
                totalSpent: 0,
                totalTopups: 0,
                enabled: false,
                approved: false,
                subscriptionStatus: 'pending',
                status: 'Pending',
                stats: { sent: 0, failed: 0 }
              }
            }, { merge: true });
            chunkUpdates++;
          }
        });

        if (chunkUpdates > 0) {
          await batch.commit();
          updatedTotal += chunkUpdates;
        }
      }

      return { success: true, message: `Integrity sync complete. ${updatedTotal} organizations updated.` };
    } catch (error) {
      console.error("SYNC_ERROR:", error);
      throw new HttpsError("internal", `Platform sync error: ${error.message}`);
    }
  }
);

/**
 * ADMIN: Decommission Ministry (Total Data Purge)
 * High-performance execution for recursive deletion of large ministries.
 */
exports.decommissionMinistry = onCall(
  { 
    region: "us-central1", 
    timeoutSeconds: 540, // Max timeout for v2 functions (9 minutes)
    memory: "2GiB"      // 2GB Memory for heavy recursion
  },
  async (request) => {
    const email = request.auth?.token?.email?.toLowerCase().trim();
    if (!email || !SUPER_ADMINS.includes(email)) {
      throw new HttpsError("permission-denied", "Unauthorized access. System Administrator privileges required.");
    }

    const { churchId } = request.data;
    if (!churchId) throw new HttpsError("invalid-argument", "Missing organization ID for decommissioning.");

    try {
      const db = admin.firestore();
      const churchRef = db.collection("churches").doc(churchId);
      
      const churchDoc = await churchRef.get();
      if (!churchDoc.exists) {
        throw new HttpsError("not-found", "Organization not found in system.");
      }

      console.log(`[DECOMMISSION_START] Purging ministry: ${churchId} triggered by: ${email}`);

      // 1. Clear SMS Locks (Root level) to prevent "protected document" errors during recursive purge
      const lockRef = db.collection("smsLocks").doc(churchId);
      await lockRef.delete().catch(() => {});

      // 2. Recursive delete all subcollections and the document itself.
      // This is a native Firestore operation that handles large datasets efficiently.
      await db.recursiveDelete(churchRef);
      
      console.log(`[DECOMMISSION_COMPLETE] Ministry: ${churchId} purged successfully.`);
      
      return { 
        success: true, 
        message: "Organization and all associated data have been permanently removed." 
      };
    } catch (error) {
      console.error("DECOMMISSION_FAILURE:", error);
      
      const message = error.message || "Unknown error during data purge.";
      
      if (message.toLowerCase().includes("deadline") || message.toLowerCase().includes("timeout")) {
        throw new HttpsError("deadline-exceeded", "The deletion process timed out due to the large volume of data. The server is still working in the background.");
      }
      
      throw new HttpsError("internal", `Purge Engine Error: ${message}`);
    }
  }
);

/**
 * ADMIN: Update Church Status
 */
exports.updateChurchStatus = onCall(
  { region: "us-central1" }, 
  async (request) => {
    const email = request.auth?.token?.email?.toLowerCase().trim();
    if (!email || !SUPER_ADMINS.includes(email)) {
      throw new HttpsError("permission-denied", "Unauthorized access");
    }

    const { churchId, status } = request.data;
    if (!churchId || !status) throw new HttpsError("invalid-argument", "Missing parameters");

    try {
      const db = admin.firestore();
      const isApproved = status === 'active';
      await db.collection("churches").doc(churchId).set({
        sms: {
          subscriptionStatus: status,
          approved: isApproved,
          status: isApproved ? 'Approved' : 'Suspended',
          enabled: isApproved
        },
        status: isApproved ? 'Approved' : 'Suspended',
        subscription: {
          status: status
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return { success: true };
    } catch (error) { 
      console.error("STATUS_UPDATE_ERROR:", error);
      throw new HttpsError("internal", error.message); 
    }
  }
);

/**
 * ADMIN: Update Organization Details
 */
exports.updateOrganization = onCall(
  { region: "us-central1" }, 
  async (request) => {
    const email = request.auth?.token?.email?.toLowerCase().trim();
    if (!email || !SUPER_ADMINS.includes(email)) {
      throw new HttpsError("permission-denied", "Unauthorized access");
    }

    const { churchId, name, slug, plan } = request.data;
    if (!churchId) throw new HttpsError("invalid-argument", "Missing organization ID");
    
    try {
      const db = admin.firestore();
      await db.collection("churches").doc(churchId).set({
        name: name || "Unnamed Ministry",
        slug: slug || "no-slug",
        plan: plan || "Starter",
        subscription: {
          plan: plan || "Starter"
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return { success: true };
    } catch (error) { 
      console.error("ORG_UPDATE_ERROR:", error);
      throw new HttpsError("internal", error.message); 
    }
  }
);

/**
 * ADMIN: Reset Balance (Wipe to 0)
 */
exports.adminResetWallet = onCall(
  { region: "us-central1" }, 
  async (request) => {
    const email = request.auth?.token?.email?.toLowerCase().trim();
    if (!email || !SUPER_ADMINS.includes(email)) {
      throw new HttpsError("permission-denied", "Unauthorized access");
    }

    const { churchId } = request.data;
    if (!churchId) throw new HttpsError("invalid-argument", "Missing organization ID");

    try {
      const result = await resetWallet(churchId, email);
      return result;
    } catch (error) {
      console.error("RESET_WALLET_ERROR:", error);
      throw new HttpsError("internal", error.message);
    }
  }
);

/**
 * ADMIN: Top Up Wallet
 */
exports.adminTopUpWallet = onCall(
  { region: "us-central1" }, 
  async (request) => {
    const email = request.auth?.token?.email?.toLowerCase().trim();
    if (!email || !SUPER_ADMINS.includes(email)) {
      throw new HttpsError("permission-denied", "Unauthorized access");
    }

    const { churchId, amount } = request.data;
    if (!churchId || amount === undefined) throw new HttpsError("invalid-argument", "Missing top-up details");

    try { 
      const result = await creditWallet(churchId, Number(amount), "admin_manual", email); 
      return result;
    } catch (error) { 
      console.error("TOPUP_ERROR:", error);
      throw new HttpsError("internal", error.message); 
    }
  }
);

/**
 * SYSTEM: Send SMS
 */
exports.sendSMS = onCall({ region: "us-central1" }, async (request) => {
  const { phone, message, type, churchId, memberName, memberId } = request.data;
  if (!churchId) throw new HttpsError("invalid-argument", "Missing context");
  try { 
    return await queueSMS(churchId, { phone, message, type, memberName, memberId }); 
  } catch (error) { 
    throw new HttpsError("internal", error.message); 
  }
});

/**
 * mNotify Delivery Webhook
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

      res.status(200).send("OK");
    } catch (error) { 
      res.status(500).send("Internal error"); 
    }
  }
);

/**
 * WORKER Triggers
 */
exports.onSmsQueued = onDocumentCreated(
  { region: "us-central1", document: "smsQueue/{messageId}", secrets: [MNOTIFY_API_KEY] },
  async (event) => {
    const data = event.data.data();
    if (data.status !== "queued") return null;
    let key;
    try { key = MNOTIFY_API_KEY.value(); } catch (e) { return null; }
    return processSMSQueueItem(key, event.params.messageId, data);
  }
);

exports.onSmsRetryTriggered = onDocumentUpdated(
  { region: "us-central1", document: "smsQueue/{messageId}", secrets: [MNOTIFY_API_KEY] },
  async (event) => {
    const data = event.data.after.data();
    const previousData = event.data.before.data();
    if (data.status === "queued" && previousData.status !== "queued") {
      let key;
      try { key = MNOTIFY_API_KEY.value(); } catch (e) { return null; }
      return processSMSQueueItem(key, event.params.messageId, data);
    }
    return null;
  }
);

/**
 * Schedulers
 */
exports.scheduledBirthdayProcessor = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "Africa/Accra",
    region: "us-central1",
    memory: "512MiB"
  },
  async () => {
    console.log("RUNNING BIRTHDAY SCHEDULER");
    await dispatchAllBirthdays();
  }
);

exports.scheduledCampaignProcessor = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "Africa/Accra",
    region: "us-central1",
  },
  async () => {
    console.log("RUNNING CAMPAIGN SCHEDULER");
    await processScheduledCampaigns();
  }
);

exports.scheduledEventReminderProcessor = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Africa/Accra",
    region: "us-central1",
  },
  async () => {
    console.log("RUNNING EVENT REMINDER SCHEDULER");
    await processEventReminders();
  }
);

exports.scheduledVisitorProcessor = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Africa/Accra",
    region: "us-central1",
  },
  async () => {
    console.log("RUNNING VISITOR FOLLOWUP SCHEDULER");
    await processVisitorFollowups();
  }
);

exports.scheduledRetryProcessor = onSchedule(
  {
    schedule: "*/5 * * * *",
    timeZone: "Africa/Accra",
    region: "us-central1",
  },
  async () => {
    console.log("RUNNING RETRY SCHEDULER");
    await retryFailedSMS();
  }
);