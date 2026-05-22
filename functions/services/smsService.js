
const axios = require("axios");
const admin = require("firebase-admin");
const { formatPhone } = require("../utils/phoneFormatter");

/**
 * SMS QUEUE WRITER
 * Validates and adds a message to the global delivery queue.
 */
async function queueSMS(churchId, payload) {
  const db = admin.firestore();
  
  // 1. Initial Validation
  const churchDoc = await db.collection("churches").doc(churchId).get();
  if (!churchDoc.exists) return { success: false, error: "Organization not found" };
  
  const churchData = churchDoc.data();
  const isApproved = churchData.sms?.approved === true || churchData.sms?.subscriptionStatus === 'active';
  
  if (!isApproved) return { success: false, error: "SMS service not approved for this account" };

  // 2. Add to Queue
  const queueRef = db.collection("smsQueue");
  await queueRef.add({
    churchId,
    phone: formatPhone(payload.phone),
    message: payload.message,
    type: payload.type || "other",
    memberId: payload.memberId || null,
    memberName: payload.memberName || null,
    status: "queued",
    retryCount: 0,
    cost: 1,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, message: "Message added to queue" };
}

/**
 * SMS DISPATCHER WORKER (Main Engine)
 * Handles wallet checks, credit deduction, and actual mNotify dispatch.
 */
async function processSMSQueueItem(apiKey, messageId, data) {
  const db = admin.firestore();
  const queueRef = db.collection("smsQueue").doc(messageId);
  const churchId = data.churchId;
  const walletRef = db.collection("smsWallets").doc(churchId);
  const logsRef = db.collection("churches").doc(churchId).collection("smsLogs");
  const txRef = db.collection("churches").doc(churchId).collection("smsTransactions");

  try {
    // 1. Atomic Wallet & Status Check (LOCKING)
    const result = await db.runTransaction(async (t) => {
      const qSnap = await t.get(queueRef);
      if (!qSnap.exists || qSnap.data().status !== "queued") {
        throw new Error("Message already processed or invalid");
      }

      const walletSnap = await t.get(walletRef);
      let balance = 0;
      
      // Fallback to legacy credits if wallet doesn't exist yet
      if (!walletSnap.exists) {
        const churchSnap = await t.get(db.collection("churches").doc(churchId));
        balance = churchSnap.data()?.sms?.credits || 0;
        t.set(walletRef, { balance: balance, churchId });
      } else {
        balance = walletSnap.data().balance || 0;
      }

      if (balance <= 0) {
        throw new Error("Insufficient SMS credits in wallet");
      }

      // Deduct Credit & Mark Processing
      const newBalance = balance - 1;
      t.update(walletRef, { 
        balance: newBalance,
        totalUsed: admin.firestore.FieldValue.increment(1)
      });

      t.update(queueRef, { status: "processing", updatedAt: admin.firestore.FieldValue.serverTimestamp() });

      // Record Transaction Ledger
      const txDoc = txRef.doc();
      t.set(txDoc, {
        type: "debit",
        amount: 1,
        balanceBefore: balance,
        balanceAfter: newBalance,
        reason: data.type || "queue_send",
        messageId: messageId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { balanceAfter: newBalance };
    });

    // 2. DISPATCH TO mNOTIFY
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const response = await axios.post(url, {
      recipient: [data.phone],
      sender: "YEBFA",
      message: data.message,
      is_schedule: false
    }, { timeout: 15000 });

    const isSent = response.status === 200 && (response.data.code === "1000" || response.data.status === "success");

    if (isSent) {
      await queueRef.update({ status: "sent", sentAt: admin.firestore.FieldValue.serverTimestamp() });
      
      // Log Analytics
      await logsRef.add({
        memberName: data.memberName || "Recipient",
        memberId: data.memberId,
        phone: data.phone,
        message: data.message,
        status: "sent",
        type: data.type,
        provider: "mnotify",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update Org counters (wrapped for safety)
      try {
        await db.collection("churches").doc(churchId).update({
          "sms.credits": result.balanceAfter,
          "sms.sent": admin.firestore.FieldValue.increment(1),
          "sms.lastSentAt": admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {}

      return { success: true };
    } else {
      throw new Error(response.data?.message || "Provider rejection");
    }

  } catch (error) {
    console.error(`[Queue Dispatcher] Error processing ${messageId}:`, error.message);
    
    // Update Queue Status to Failed
    await queueRef.update({ 
      status: "failed", 
      error: error.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    });

    // Log failure for tenant
    await logsRef.add({
      memberName: data.memberName || "Recipient",
      phone: data.phone,
      message: data.message,
      status: "failed",
      error: error.message,
      type: data.type,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Increment Org Failure count
    try {
      await db.collection("churches").doc(churchId).update({
        "sms.failed": admin.firestore.FieldValue.increment(1)
      });
    } catch (e) {}

    return { success: false, error: error.message };
  }
}

module.exports = { queueSMS, processSMSQueueItem };
