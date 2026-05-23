const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
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
 * ADMIN: System Stats Aggregation (v2 Callable)
 */
exports.getSystemStats = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const email = request.auth.token.email?.toLowerCase();
    if (!SUPER_ADMINS.includes(email)) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }

    const db = admin.firestore();
    const churchesSnap = await db.collection("churches").get();

    const churches = churchesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const totalRevenue = churches.reduce((sum, c) => sum + Number(c.sms?.totalTopups || 0), 0);
    const totalSent = churches.reduce((sum, c) => sum + Number(c.sms?.sent || 0), 0);
    const totalFailed = churches.reduce((sum, c) => sum + Number(c.sms?.failed || 0), 0);

    return {
      churches: churches.sort((a, b) => {
        const getSec = (v) => v?.seconds || (v ? new Date(v).getTime() / 1000 : 0);
        return getSec(b.registeredAt) - getSec(a.registeredAt);
      }),
      totalTenants: churches.length,
      activeTenants: churches.filter(c => c.sms?.subscriptionStatus === "active").length,
      totalRevenue,
      totalSent,
      totalFailed,
      topSpenders: churches
        .sort((a, b) => Number(b.sms?.sent || 0) - Number(a.sms?.sent || 0))
        .slice(0, 5)
        .map(c => ({
          name: c.name,
          sent: c.sms?.sent || 0,
          balance: c.sms?.credits || 0
        }))
    };
  } catch (error) {
    console.error("getSystemStats engine failure:", error);
    throw new HttpsError("internal", error.message || "Stats aggregation failed");
  }
});

/**
 * ADMIN: Update Church Status (v2 Callable)
 */
exports.updateChurchStatus = onCall(async (request) => {
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
  } catch (error) { 
    throw new HttpsError("internal", error.message); 
  }
});

/**
 * ADMIN: Update Organization Profile (v2 Callable)
 */
exports.updateOrganization = onCall(async (request) => {
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
  } catch (error) { 
    throw new HttpsError("internal", error.message); 
  }
});

/**
 * ADMIN: Top Up Wallet (v2 Callable)
 */
exports.adminTopUpWallet = onCall(async (request) => {
  if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email?.toLowerCase())) {
    throw new HttpsError("permission-denied", "Unauthorized");
  }
  const { churchId, amount } = request.data;
  try { 
    return await creditWallet(churchId, amount, "admin_manual", request.auth.token.email); 
  } catch (error) { 
    throw new HttpsError("internal", error.message); 
  }
});

/**
 * SYSTEM: Send SMS (v2 Callable)
 */
exports.sendSMS = onCall(async (request) => {
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
 * MISSION CRITICAL WORKER (Triggers)
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
