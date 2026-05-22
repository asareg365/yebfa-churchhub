
const axios = require("axios");
const admin = require("firebase-admin");
const { formatPhone } = require("../utils/phoneFormatter");

/**
 * SMS QUEUE WRITER
 * Supports dedupeKey for enterprise-grade idempotency.
 */
async function queueSMS(churchId, payload) {
  const db = admin.firestore();
  
  const churchDoc = await db.collection("churches").doc(churchId).get();
  if (!churchDoc.exists) return { success: false, error: "Organization not found" };
  
  const churchData = churchDoc.data();
  const isApproved = churchData.sms?.approved === true || churchData.sms?.subscriptionStatus === 'active';
  
  if (!isApproved) return { success: false, error: "SMS service not approved for this account" };

  const queueRef = db.collection("smsQueue");
  const cost = payload.cost || 1;
  const dedupeKey = payload.dedupeKey || null;

  // STEP 1: DEDUPLICATION CHECK
  if (dedupeKey) {
    const existing = await queueRef
      .where("dedupeKey", "==", dedupeKey)
      .where("status", "in", ["queued", "processing", "sent"])
      .limit(1)
      .get();

    if (!existing.empty) {
      return { 
        success: true, 
        skipped: true, 
        reason: "Duplicate message prevented by idempotency key" 
      };
    }
  }
  
  const signature = ` - ${churchData.sms?.displayName || churchData.name || "Church"}`;
  const finalMessage = payload.message.endsWith(signature) 
    ? payload.message 
    : `${payload.message}${signature}`;

  // STEP 2: ADD TO QUEUE
  await queueRef.add({
    churchId,
    phone: formatPhone(payload.phone),
    message: finalMessage,
    type: payload.type || "other",
    metadata: {
      memberId: payload.memberId || null,
      memberName: payload.memberName || null,
    },
    status: "queued",
    retryCount: payload.retryCount || 0,
    maxRetries: 3,
    cost: cost,
    dedupeKey: dedupeKey,
    scheduledAt: payload.scheduledAt || admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, message: "Message added to queue" };
}

/**
 * WALLET DEBIT
 */
async function debitWallet(t, walletRef, churchRef, cost, churchId, messageId, type) {
  const walletSnap = await t.get(walletRef);
  const walletData = walletSnap.exists ? walletSnap.data() : { balance: 0 };
  const currentBalance = walletData.balance || 0;

  if (currentBalance < cost) {
    throw new Error("Insufficient SMS credits");
  }

  const newBalance = currentBalance - cost;

  t.update(walletRef, {
    balance: newBalance,
    totalSpent: admin.firestore.FieldValue.increment(cost),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  t.update(churchRef, { 
    "sms.credits": newBalance,
    "sms.sent": admin.firestore.FieldValue.increment(1),
    "sms.lastSentAt": admin.firestore.FieldValue.serverTimestamp()
  });

  const txRef = admin.firestore().collection("smsTransactions").doc();
  t.set(txRef, {
    churchId,
    type: "debit",
    amount: cost,
    balanceBefore: currentBalance,
    balanceAfter: newBalance,
    reason: `sms_send_${type}`,
    messageId: messageId,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * WALLET REFUND
 */
async function refundWallet(churchId, amount, reason, messageId) {
  const db = admin.firestore();
  const walletRef = db.collection("smsWallets").doc(churchId);
  const churchRef = db.collection("churches").doc(churchId);

  await db.runTransaction(async (t) => {
    const walletSnap = await t.get(walletRef);
    const walletData = walletSnap.exists ? walletSnap.data() : { balance: 0 };
    const currentBalance = walletData.balance || 0;
    const newBalance = currentBalance + amount;

    t.update(walletRef, {
      balance: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    t.update(churchRef, {
      "sms.credits": newBalance,
      "sms.refunded": admin.firestore.FieldValue.increment(1)
    });

    const txRef = db.collection("smsTransactions").doc();
    t.set(txRef, {
      churchId,
      type: "refund",
      amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      reason,
      messageId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
}

/**
 * WALLET CREDIT
 */
async function creditWallet(churchId, amount, reason = "topup", processedBy = "system") {
  const db = admin.firestore();
  const walletRef = db.collection("smsWallets").doc(churchId);
  const churchRef = db.collection("churches").doc(churchId);

  await db.runTransaction(async (t) => {
    const walletSnap = await t.get(walletRef);
    const walletData = walletSnap.exists ? walletSnap.data() : { balance: 0, totalTopups: 0 };
    const currentBalance = walletData.balance || 0;
    const newBalance = currentBalance + amount;

    t.set(walletRef, {
      balance: newBalance,
      totalTopups: (walletData.totalTopups || 0) + amount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    t.update(churchRef, {
      "sms.credits": newBalance,
      "sms.lastTopupAt": admin.firestore.FieldValue.serverTimestamp()
    });

    const txRef = db.collection("smsTransactions").doc();
    t.set(txRef, {
      churchId,
      type: "credit",
      amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      reason,
      processedBy,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
}

/**
 * SMS DISPATCHER WORKER
 */
async function processSMSQueueItem(apiKey, messageId, data) {
  const db = admin.firestore();
  const queueRef = db.collection("smsQueue").doc(messageId);
  const churchId = data.churchId;
  const churchRef = db.collection("churches").doc(churchId);
  const walletRef = db.collection("smsWallets").doc(churchId);
  const logsRef = churchRef.collection("smsLogs");
  const reportsRef = db.collection("smsDeliveryReports");

  // STEP 1: LOCK MESSAGE
  const claimed = await db.runTransaction(async (t) => {
    const snap = await t.get(queueRef);
    if (!snap.exists) return false;
    const current = snap.data();
    if (current.status !== "queued") return false;

    t.update(queueRef, {
      status: "processing",
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return true;
  });

  if (!claimed) return null;

  try {
    // STEP 2: DEBIT WALLET
    await db.runTransaction(async (t) => {
      await debitWallet(t, walletRef, churchRef, data.cost || 1, churchId, messageId, data.type);
    });

    // STEP 3: SEND SMS
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const response = await axios.post(url, {
      recipient: [data.phone],
      sender: "YEBFA",
      message: data.message,
      is_schedule: false
    }, { timeout: 15000 });

    const isSent = response.status === 200 && (response.data?.code === "1000" || response.data?.status === "success");

    if (isSent) {
      const summary = response.data?.summary?.[0] || {};
      const providerId = summary.message_id || "mnotify_" + Date.now();

      await queueRef.update({ 
        status: "sent", 
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        providerMessageId: providerId
      });
      
      // LOG TO AUDIT
      await logsRef.add({
        memberName: data.metadata?.memberName || "Recipient",
        memberId: data.metadata?.memberId,
        phone: data.phone,
        message: data.message,
        status: "sent",
        type: data.type,
        cost: data.cost,
        provider: "mnotify",
        providerMessageId: providerId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // CREATE DELIVERY REPORT BRIDGE
      await reportsRef.add({
        churchId,
        messageId,
        providerMessageId: providerId,
        phone: data.phone,
        status: summary.status || "queued",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } else {
      throw new Error(response.data?.message || "Provider rejection");
    }

  } catch (error) {
    console.error(`[Queue Dispatcher] Error processing ${messageId}:`, error.message);
    
    const retryCount = (data.retryCount || 0) + 1;
    const maxRetries = data.maxRetries || 3;

    if (retryCount <= maxRetries && error.message !== "Insufficient SMS credits") {
      await queueRef.update({
        status: "queued",
        retryCount: retryCount,
        error: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // PERMANENT FAILURE
      await queueRef.update({ 
        status: "failed", 
        error: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      });

      if (error.message !== "Insufficient SMS credits") {
        try {
          await refundWallet(churchId, data.cost || 1, "sms_delivery_failed", messageId);
        } catch (refundError) {
          console.error(`[Refund System] Critical Error:`, refundError.message);
        }
      }

      try {
        await logsRef.add({
          memberName: data.metadata?.memberName || "Recipient",
          phone: data.phone,
          message: data.message,
          status: "failed",
          error: error.message,
          type: data.type,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        await churchRef.update({ "sms.failed": admin.firestore.FieldValue.increment(1) });
      } catch (e) {}
    }
    return { success: false, error: error.message };
  }
}

/**
 * MNOTIFY WEBHOOK HANDLER
 * Receives real-time delivery updates from provider.
 */
async function handleMNotifyWebhook(req, res) {
  const db = admin.firestore();
  const payload = req.body; 
  // Expecting: { message_id, status, recipient, network, ... }
  
  if (!payload.message_id) {
    console.warn("[Webhook] Received request without message_id:", payload);
    return res.status(200).send("Ignored: No message_id");
  }

  console.log(`[Webhook] Processing update for providerId: ${payload.message_id}, status: ${payload.status}`);

  try {
    const providerId = payload.message_id;
    const status = payload.status?.toLowerCase() || "unknown";

    // 1. Find the technical report bridge
    const reportsSnap = await db.collection("smsDeliveryReports")
      .where("providerMessageId", "==", providerId)
      .limit(1)
      .get();

    if (reportsSnap.empty) {
      console.warn(`[Webhook] No report found for providerId: ${providerId}`);
      return res.status(200).send("Logged: Report not found");
    }

    const reportDoc = reportsSnap.docs[0];
    const reportData = reportDoc.data();
    const { churchId, messageId } = reportData;

    // 2. Update technical report
    await reportDoc.ref.update({
      status: status,
      network: payload.network || reportData.network || "unknown",
      deliveredAt: status === "delivered" ? admin.firestore.FieldValue.serverTimestamp() : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 3. Update global queue status
    if (messageId) {
      await db.collection("smsQueue").doc(messageId).update({
        providerStatus: status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // 4. Update organization log
    const logsSnap = await db.collection("churches").doc(churchId).collection("smsLogs")
      .where("providerMessageId", "==", providerId)
      .limit(1)
      .get();

    if (!logsSnap.empty) {
      const logRef = logsSnap.docs[0].ref;
      await logRef.update({
        providerStatus: status,
        // Map carrier status to internal log status
        status: status === "delivered" ? "sent" : (status === "failed" || status === "undelivered" ? "failed" : "sent"),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return res.status(200).send("Webhook Processed");

  } catch (err) {
    console.error("[Webhook Error]:", err.message);
    return res.status(500).send("Processing Error");
  }
}

/**
 * ADMIN ANALYTICS HELPERS
 */
async function getPlatformStats() {
  const db = admin.firestore();
  try {
    const churchesSnap = await db.collection("churches").get();
    const walletsSnap = await db.collection("smsWallets").get();

    let totalSent = 0;
    let totalFailed = 0;
    let totalCredits = 0;

    walletsSnap.forEach(doc => {
      const data = doc.data();
      if (data && typeof data.balance === 'number') totalCredits += data.balance;
    });

    churchesSnap.forEach(doc => {
      const data = doc.data();
      if (data && data.sms) {
        totalSent += (data.sms.sent || 0);
        totalFailed += (data.sms.failed || 0);
      }
    });

    return {
      totalTenants: churchesSnap.size || 0,
      totalSent,
      totalFailed,
      globalCreditPool: totalCredits,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error("Error in getPlatformStats:", err);
    throw err;
  }
}

module.exports = { 
  queueSMS, 
  processSMSQueueItem, 
  creditWallet, 
  getPlatformStats,
  handleMNotifyWebhook
};
