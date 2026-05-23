const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const MNOTIFY_API_KEY = defineSecret("MNOTIFY_API_KEY");
const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];

const { processSMSQueueItem, queueSMS, creditWallet, resetWallet } = require("./services/smsService");

/**
 * ADMIN: System Stats Aggregation (v2 Callable)
 * PRODUCTION GRADE: Reads balance from smsWallets ledger.
 */
exports.getSystemStats = onCall(
  {
    region: "us-central1",
    cors: true
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const email = request.auth.token.email?.toLowerCase();
    if (!SUPER_ADMINS.includes(email)) {
      throw new HttpsError("permission-denied", "Unauthorized access");
    }

    try {
      const db = admin.firestore();
      const [churchesSnap, walletsSnap] = await Promise.all([
        db.collection("churches").get(),
        db.collection("smsWallets").get()
      ]);

      const walletsMap = {};
      walletsSnap.forEach(doc => {
        walletsMap[doc.id] = doc.data();
      });

      const churches = churchesSnap.docs.map(doc => {
        const d = doc.data();
        const wallet = walletsMap[doc.id] || {};
        
        // Ledger Truth (smsWallets) is the primary source
        const ledgerBalance = wallet.balance !== undefined ? Number(wallet.balance) : Number(d.sms?.credits || 0);

        return {
          id: doc.id,
          name: d.name || "Unnamed Ministry",
          slug: d.slug || "no-slug",
          plan: d.plan || "Starter",
          registeredAt: d.registeredAt?.toDate ? d.registeredAt.toDate().toISOString() : (d.registeredAt ? String(d.registeredAt) : null),
          sms: {
            credits: ledgerBalance, // SOURCE OF TRUTH
            sent: Number(d.sms?.stats?.sent || 0),
            failed: Number(d.sms?.stats?.failed || 0),
            totalTopups: Number(wallet.totalTopups || d.sms?.totalTopups || 0),
            subscriptionStatus: d.sms?.subscriptionStatus || "inactive",
            hasWallet: wallet.balance !== undefined
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
      console.error("STATS ENGINE FAILURE:", err);
      throw new HttpsError("internal", err.message || "Stats engine failed");
    }
  }
);

/**
 * ADMIN: Initialize Missing Wallets (Emergency Migration)
 */
exports.initializeWallets = onCall(
  { region: "us-central1", cors: true },
  async (request) => {
    if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email?.toLowerCase())) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }

    const db = admin.firestore();
    const churchesSnap = await db.collection("churches").get();
    let created = 0;

    for (const doc of churchesSnap.docs) {
      const church = doc.data();
      const churchId = doc.id;
      const walletRef = db.collection("smsWallets").doc(churchId);
      const walletSnap = await walletRef.get();

      if (!walletSnap.exists) {
        const credits = Number(church.sms?.credits || 0);
        await walletRef.set({
          balance: credits,
          totalSpent: Number(church.sms?.stats?.sent || 0),
          totalTopups: credits,
          currency: "SMS_CREDIT",
          status: "active",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        created++;
      }
    }

    return {
      success: true,
      walletsCreated: created
    };
  }
);

/**
 * ADMIN: Update Church Status
 */
exports.updateChurchStatus = onCall(
  { region: "us-central1", cors: true }, 
  async (request) => {
    if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email?.toLowerCase())) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }
    const { churchId, status } = request.data;
    if (!churchId || !status) throw new HttpsError("invalid-argument", "Missing parameters");

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
  }
);

/**
 * ADMIN: Update Organization Details
 */
exports.updateOrganization = onCall(
  { region: "us-central1", cors: true }, 
  async (request) => {
    if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email?.toLowerCase())) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }
    const { churchId, name, slug, plan } = request.data;
    if (!churchId) throw new HttpsError("invalid-argument", "Missing organization ID");
    
    try {
      await admin.firestore().collection("churches").doc(churchId).update({
        name: name || "Unnamed Ministry",
        slug: slug || "no-slug",
        plan: plan || "Starter",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) { 
      throw new HttpsError("internal", error.message); 
    }
  }
);

/**
 * ADMIN: Reset Balance (Wipe to 0)
 */
exports.adminResetWallet = onCall(
  { region: "us-central1", cors: true }, 
  async (request) => {
    if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email?.toLowerCase())) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }
    const { churchId } = request.data;
    if (!churchId) throw new HttpsError("invalid-argument", "Missing organization ID");

    try {
      const result = await resetWallet(churchId, request.auth.token.email);
      return result;
    } catch (error) {
      throw new HttpsError("internal", error.message);
    }
  }
);

/**
 * ADMIN: Top Up Wallet
 */
exports.adminTopUpWallet = onCall(
  { region: "us-central1", cors: true }, 
  async (request) => {
    if (!request.auth || !SUPER_ADMINS.includes(request.auth.token.email?.toLowerCase())) {
      throw new HttpsError("permission-denied", "Unauthorized");
    }
    const { churchId, amount } = request.data;
    if (!churchId || !amount) throw new HttpsError("invalid-argument", "Missing top-up details");

    try { 
      const result = await creditWallet(churchId, Number(amount), "admin_manual", request.auth.token.email); 
      return result;
    } catch (error) { 
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
