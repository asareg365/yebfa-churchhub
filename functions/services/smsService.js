
const axios = require("axios");
const admin = require("firebase-admin");
const { formatPhone } = require("../utils/phoneFormatter");

/**
 * SMS QUEUE WRITER (The Gatekeeper)
 * Standard helper to validate and add a message to the global delivery queue.
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
  
  await queueRef.add({
    churchId,
    phone: formatPhone(payload.phone),
    message: payload.message,
    type: payload.type || "other",
    metadata: {
      memberId: payload.memberId || null,
      memberName: payload.memberName || null,
    },
    status: "queued",
    retryCount: payload.retryCount || 0,
    maxRetries: 3,
    cost: cost,
    scheduledAt: payload.scheduledAt || admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, message: "Message added to queue" };
}

/**
 * SOURCE OF TRUTH WALLET DEBIT
 * Strictly called within Worker Transaction.
 */
async function debitWallet(t, walletRef, churchRef, cost, churchId, messageId, type) {
  const walletSnap = await t.get(walletRef);
  const walletData = walletSnap.exists ? walletSnap.data() : { balance: 0 };
  const currentBalance = walletData.balance || 0;

  if (currentBalance < cost) {
    throw new Error("Insufficient SMS credits");
  }

  const newBalance = currentBalance - cost;

  // 1. Update Source of Truth (Wallet)
  t.update(walletRef, {
    balance: newBalance,
    totalSpent: admin.firestore.FieldValue.increment(cost),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2. Update Display Cache (Church Doc)
  t.update(churchRef, { 
    "sms.credits": newBalance,
    "sms.sent": admin.firestore.FieldValue.increment(1),
    "sms.lastSentAt": admin.firestore.FieldValue.serverTimestamp()
  });

  // 3. Record Ledger Entry (Transaction)
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
 * SMS DISPATCHER WORKER (Main Engine)
 * Triggered by Firestore onCreate(smsQueue/{id})
 * Handles atomic wallet ledger and mNotify dispatch.
 */
async function processSMSQueueItem(apiKey, messageId, data) {
  const db = admin.firestore();
  const queueRef = db.collection("smsQueue").doc(messageId);
  const churchId = data.churchId;
  const churchRef = db.collection("churches").doc(churchId);
  const walletRef = db.collection("smsWallets").doc(churchId);
  const logsRef = churchRef.collection("smsLogs");

  if (data.status !== "queued") return null;

  try {
    // 1. LOCK MESSAGE
    await queueRef.update({ 
      status: "processing",
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    });

    // 2. ATOMIC LEDGER DEDUCTION (Charge First)
    await db.runTransaction(async (t) => {
      await debitWallet(t, walletRef, churchRef, data.cost || 1, churchId, messageId, data.type);
    });

    // 3. DISPATCH TO PROVIDER (mNotify)
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const response = await axios.post(url, {
      recipient: [data.phone],
      sender: "YEBFA",
      message: data.message,
      is_schedule: false
    }, { timeout: 15000 });

    const isSent = response.status === 200 && (response.data.code === "1000" || response.data.status === "success");

    if (isSent) {
      await queueRef.update({ 
        status: "sent", 
        sentAt: admin.firestore.FieldValue.serverTimestamp() 
      });
      
      await logsRef.add({
        memberName: data.metadata?.memberName || "Recipient",
        memberId: data.metadata?.memberId,
        phone: data.phone,
        message: data.message,
        status: "sent",
        type: data.type,
        cost: data.cost,
        provider: "mnotify",
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
      await queueRef.update({ 
        status: "failed", 
        error: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      });

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

        await churchRef.update({
          "sms.failed": admin.firestore.FieldValue.increment(1)
        });
      } catch (e) {}
    }

    return { success: false, error: error.message };
  }
}

module.exports = { queueSMS, processSMSQueueItem };
