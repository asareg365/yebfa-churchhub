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
 * ADMIN: System Stats Aggregation
 */
exports.getSystemStats = onCall(
  { region: "us-central1" },
  async (request) => {
    const email = request.auth?.token?.email?.toLowerCase().trim();
    if (!email || !SUPER_ADMINS.includes(email)) {
      throw new HttpsError("permission-denied", "Unauthorized access.");
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
          deletionStatus: d.deletionStatus || null,
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
      throw new HttpsError("internal", "Stats engine encountered an internal failure.");
    }
  }
);

/**
 * ADMIN: Delete Ministry (DEBUG VERSION)
 */
exports.deleteMinistry = onCall(
  { region: "us-central1" },
  async (request) => {
    console.log("STEP 0: function entered");

    try {
      const email = request.auth?.token?.email?.toLowerCase().trim();
      console.log("STEP 1: auth ok", email);

      if (!SUPER_ADMINS.includes(email)) {
        throw new HttpsError("permission-denied", "Unauthorized");
      }

      const { churchId } = request.data || {};
      console.log("STEP 2: churchId", churchId);

      if (!churchId) {
        throw new HttpsError("invalid-argument", "Missing churchId");
      }

      const db = admin.firestore();
      const churchRef = db.collection("churches").doc(churchId);

      const churchDoc = await churchRef.get();
      console.log("STEP 3: church exists?", churchDoc.exists);

      if (!churchDoc.exists) {
        throw new HttpsError("not-found", "Organization not found.");
      }

      // Safety Shield
      const churchData = churchDoc.data();
      if (churchData.sms?.subscriptionStatus === "active" || churchData.status === "Approved") {
        console.log("STEP 3.5: Safety Shield Triggered");
        throw new HttpsError(
          "failed-precondition", 
          "Safety Shield Active: You must suspend the organization service first before it can be deleted."
        );
      }

      console.log("STEP 4: deleting smsLocks");
      await db.collection("smsLocks").doc(churchId).delete().catch(console.error);

      console.log("STEP 5: deleting ledger");
      let snap;
      let i = 0;

      do {
        i++;
        snap = await db.collection("smsLedger")
          .where("churchId", "==", churchId)
          .limit(200)
          .get();

        console.log("ledger batch", i, snap.size);

        if (!snap.empty) {
          const batch = db.batch();
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }

      } while (!snap.empty && i < 100);

      console.log("STEP 6: BEFORE recursive delete (DISABLED FOR DEBUG)");
      // await db.recursiveDelete(churchRef);

      console.log("STEP 7: deleting church doc");
      await churchRef.delete();

      console.log("STEP 8: DONE");

      return { success: true };
    } catch (error) {
      console.error("🔥 FULL DELETE ERROR:", error);
      throw new HttpsError("internal", error.message);
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