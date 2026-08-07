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
 * Helper to verify Super Admin status
 */
function verifySuperAdmin(request) {
  const email = request.auth?.token?.email?.toLowerCase().trim();
  if (!email || !SUPER_ADMINS.includes(email)) {
    console.error("PERMISSION_DENIED: User is not a super admin", { email });
    throw new HttpsError("permission-denied", "Unauthorized access. System Administrator only.");
  }
  return email;
}

/**
 * ADMIN: System Stats Aggregation
 */
exports.getSystemStats = onCall(
  { region: "us-central1" },
  async (request) => {
    verifySuperAdmin(request);

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
          deletionStatus: d.deletionStatus || null,
          deletedAt: d.deletedAt?.toDate ? d.deletedAt.toDate().toISOString() : null,
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
        if (church.deletionStatus !== 'DELETED') {
          totalRevenue += Number(church.sms?.totalTopups || 0);
          totalSent += Number(church.sms?.sent || 0);
          totalFailed += Number(church.sms?.failed || 0);
          if (church.sms?.subscriptionStatus === "active") {
            activeTenants++;
          }
        }
      });

      const topSpenders = churches
        .filter(c => c.deletionStatus !== 'DELETED')
        .sort((a, b) => (Number(b.sms?.sent || 0)) - (Number(a.sms?.sent || 0)))
        .slice(0, 5)
        .map(c => ({
          name: c.name,
          sent: Number(c.sms?.sent || 0),
          balance: Number(c.sms?.credits || 0)
        }));

      return {
        success: true,
        totalTenants: churches.filter(c => c.deletionStatus !== 'DELETED').length,
        activeTenants,
        totalRevenue,
        totalSent,
        totalFailed,
        churches,
        topSpenders
      };
    } catch (err) {
      console.error("STATS_ENGINE_FAILURE:", err);
      throw new HttpsError("internal", "Stats engine encountered an internal failure.");
    }
  }
);

/**
 * ADMIN: Soft Delete Ministry
 */
exports.deleteMinistry = onCall(
  { region: "us-central1" },
  async (request) => {
    const adminEmail = verifySuperAdmin(request);
    const { churchId } = request.data || {};
    if (!churchId) throw new HttpsError("invalid-argument", "Missing churchId");

    try {
      const db = admin.firestore();
      const churchRef = db.collection("churches").doc(churchId);
      const churchDoc = await churchRef.get();

      if (!churchDoc.exists) throw new HttpsError("not-found", "Organization not found.");

      const churchData = churchDoc.data();
      const isActuallyActive = churchData.sms?.subscriptionStatus === "active" || 
                               churchData.status === "Approved" || 
                               churchData.subscription?.status === "active";

      if (isActuallyActive) {
        throw new HttpsError(
          "failed-precondition", 
          "Safety Shield Active: You must suspend the organization service first before it can be moved to the Recycle Bin."
        );
      }

      await churchRef.update({
        deletionStatus: "DELETED",
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        deletedBy: adminEmail,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error("SOFT_DELETE_ERROR:", error);
      throw new HttpsError("internal", error.message);
    }
  }
);

/**
 * ADMIN: Restore Ministry
 */
exports.restoreMinistry = onCall(
  { region: "us-central1" },
  async (request) => {
    verifySuperAdmin(request);
    const { churchId } = request.data || {};
    if (!churchId) throw new HttpsError("invalid-argument", "Missing churchId");

    try {
      const db = admin.firestore();
      await db.collection("churches").doc(churchId).update({
        deletionStatus: null,
        deletedAt: null,
        deletedBy: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error("RESTORE_ERROR:", error);
      throw new HttpsError("internal", error.message);
    }
  }
);

/**
 * ADMIN: Permanent Purge (Hard Delete)
 */
exports.hardPurgeMinistry = onCall(
  { region: "us-central1", memory: "2GiB", timeoutSeconds: 540 },
  async (request) => {
    verifySuperAdmin(request);
    const { churchId } = request.data || {};
    if (!churchId) throw new HttpsError("invalid-argument", "Missing churchId");

    const db = admin.firestore();
    const churchRef = db.collection("churches").doc(churchId);

    try {
      // 1. Scrub Global Ledger
      let snap;
      let i = 0;
      do {
        i++;
        snap = await db.collection("smsLedger")
          .where("churchId", "==", churchId)
          .limit(200)
          .get();

        if (!snap.empty) {
          const batch = db.batch();
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } while (!snap.empty && i < 100);

      // 2. Scrub Locks
      await db.collection("smsLocks").doc(churchId).delete().catch(console.error);

      // 3. Scrub Queue items
      let qSnap;
      let qCount = 0;
      do {
        qCount++;
        qSnap = await db.collection("smsQueue")
          .where("churchId", "==", churchId)
          .limit(200)
          .get();

        if (!qSnap.empty) {
          const batch = db.batch();
          qSnap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } while (!qSnap.empty && qCount < 100);

      // 4. Recursive Delete
      await db.recursiveDelete(churchRef);

      return { success: true };
    } catch (error) {
      console.error("HARD_PURGE_ERROR:", error);
      throw new HttpsError("internal", "Deep purge failed: " + error.message);
    }
  }
);

/**
 * ADMIN: Update Church Status (Activate/Suspend)
 */
exports.updateChurchStatus = onCall(
  { region: "us-central1" }, 
  async (request) => {
    verifySuperAdmin(request);

    if (!request.data) throw new HttpsError("invalid-argument", "Missing payload");
    const { churchId, status } = request.data;
    if (!churchId || !status) throw new HttpsError("invalid-argument", "Missing parameters");

    try {
      const db = admin.firestore();
      const isApproved = status === 'active';
      const label = isApproved ? 'Approved' : 'Suspended';

      console.log(`Updating status for ${churchId} to ${status}`);

      // We use dot-notation for safety, but check if root maps exist
      const churchDoc = await db.collection("churches").doc(churchId).get();
      if (!churchDoc.exists) throw new HttpsError("not-found", "Organization not found");

      const updateData = {
        "sms.subscriptionStatus": status,
        "sms.approved": isApproved,
        "sms.status": label,
        "sms.enabled": isApproved,
        "status": label,
        "subscription.status": status,
        "updatedAt": admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("churches").doc(churchId).update(updateData);

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
    verifySuperAdmin(request);
    if (!request.data) throw new HttpsError("invalid-argument", "Missing payload");
    const { churchId, name, slug, plan } = request.data;
    if (!churchId) throw new HttpsError("invalid-argument", "Missing organization ID");
    
    try {
      const db = admin.firestore();
      await db.collection("churches").doc(churchId).update({
        "name": name || "Unnamed Ministry",
        "slug": slug || "no-slug",
        "plan": plan || "Starter",
        "subscription.plan": plan || "Starter",
        "updatedAt": admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) { 
      console.error("ORG_UPDATE_ERROR:", error);
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
    const adminEmail = verifySuperAdmin(request);
    if (!request.data) throw new HttpsError("invalid-argument", "Missing payload");
    const { churchId, amount } = request.data;
    if (!churchId || amount === undefined) throw new HttpsError("invalid-argument", "Missing top-up details");

    try { 
      const result = await creditWallet(churchId, Number(amount), "admin_manual", adminEmail); 
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
  const { phone, message, type, churchId, memberName, memberId } = request.data || {};
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
      const logDoc = await db.collectionGroup("smsLogs")
        .where("providerId", "==", String(message_id))
        .limit(1)
        .get();

      if (logDoc.empty) {
        return res.status(200).send("Log record not found (Ignored)");
      }

      const logRef = logDoc.docs[0].ref;
      const normalizedStatus = (status || "").toLowerCase();
      const finalStatus = normalizedStatus === "delivered" ? "delivered" : "sent";

      await logRef.update({
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
    console.log("=== BIRTHDAY SCHEDULER STARTED ===");
    try {
      await dispatchAllBirthdays();
      console.log("=== BIRTHDAY SCHEDULER COMPLETED ===");
    } catch (err) {
      console.error("BIRTHDAY SCHEDULER FAILED:", err);
    }
  }
);

exports.scheduledCampaignProcessor = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "Africa/Accra",
    region: "us-central1",
  },
  async () => {
    console.log("=== CAMPAIGN SCHEDULER STARTED ===");
    try {
      await processScheduledCampaigns();
      console.log("=== CAMPAIGN SCHEDULER COMPLETED ===");
    } catch (err) {
      console.error("CAMPAIGN SCHEDULER FAILED:", err);
    }
  }
);

exports.scheduledEventReminderProcessor = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Africa/Accra",
    region: "us-central1",
  },
  async () => {
    console.log("=== EVENT REMINDER SCHEDULER STARTED ===");
    try {
      await processEventReminders();
      console.log("=== EVENT REMINDER SCHEDULER COMPLETED ===");
    } catch (err) {
      console.error("EVENT REMINDER SCHEDULER FAILED:", err);
    }
  }
);

exports.scheduledVisitorProcessor = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Africa/Accra",
    region: "us-central1",
  },
  async () => {
    console.log("=== VISITOR FOLLOWUP SCHEDULER STARTED ===");
    try {
      await processVisitorFollowups();
      console.log("=== VISITOR FOLLOWUP SCHEDULER COMPLETED ===");
    } catch (err) {
      console.error("VISITOR FOLLOWUP SCHEDULER FAILED:", err);
    }
  }
);

exports.scheduledRetryProcessor = onSchedule(
  {
    schedule: "*/5 * * * *",
    timeZone: "Africa/Accra",
    region: "us-central1",
  },
  async () => {
    console.log("=== RETRY SCHEDULER STARTED ===");
    try {
      await retryFailedSMS();
      console.log("=== RETRY SCHEDULER COMPLETED ===");
    } catch (err) {
      console.error("RETRY SCHEDULER FAILED:", err);
    }
  }
);
