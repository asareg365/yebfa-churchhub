
const axios = require("axios");
const admin = require("firebase-admin");
const { formatPhone } = require("../utils/phoneFormatter");

/**
 * SMS QUEUE WRITER
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
  
  const signature = ` - ${churchData.sms?.displayName || churchData.name || "Church"}`;
  const finalMessage = payload.message.endsWith(signature) 
    ? payload.message 
    : `${payload.message}${signature}`;

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

  if (data.status !== "queued") return null;

  try {
    await queueRef.update({ 
      status: "processing",
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    });

    await db.runTransaction(async (t) => {
      await debitWallet(t, walletRef, churchRef, data.cost || 1, churchId, messageId, data.type);
    });

    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const response = await axios.post(url, {
      recipient: [data.phone],
      sender: "YEBFA",
      message: data.message,
      is_schedule: false
    }, { timeout: 15000 });

    const isSent = response.status === 200 && (response.data?.code === "1000" || response.data?.status === "success");

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
      if (data && typeof data.balance === 'number') {
        totalCredits += data.balance;
      }
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
  getPlatformStats 
};
