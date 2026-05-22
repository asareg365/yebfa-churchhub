
const axios = require("axios");
const admin = require("firebase-admin");
const { formatPhone } = require("../utils/phoneFormatter");

/**
 * SMS QUEUE WRITER
 * Standard helper to validate and add a message to the global delivery queue.
 */
async function queueSMS(churchId, payload) {
  const db = admin.firestore();
  
  // Initial Validation
  const churchDoc = await db.collection("churches").doc(churchId).get();
  if (!churchDoc.exists) return { success: false, error: "Organization not found" };
  
  const churchData = churchDoc.data();
  const isApproved = churchData.sms?.approved === true || churchData.sms?.subscriptionStatus === 'active';
  
  if (!isApproved) return { success: false, error: "SMS service not approved for this account" };

  // Add to Queue
  const queueRef = db.collection("smsQueue");
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
    retryCount: 0,
    maxRetries: 3,
    cost: 1,
    scheduledAt: payload.scheduledAt || admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, message: "Message added to queue" };
}

/**
 * SMS DISPATCHER WORKER (Main Engine)
 * Triggered by Firestore onCreate(smsQueue/{id})
 * Handles atomic wallet logic and mNotify dispatch.
 */
async function processSMSQueueItem(apiKey, messageId, data) {
  const db = admin.firestore();
  const queueRef = db.collection("smsQueue").doc(messageId);
  const churchId = data.churchId;
  const churchRef = db.collection("churches").doc(churchId);
  const logsRef = churchRef.collection("smsLogs");
  const txRef = churchRef.collection("smsTransactions");

  try {
    // 1. LOCK & CHARGE (Atomic Transaction)
    const result = await db.runTransaction(async (t) => {
      const qSnap = await t.get(queueRef);
      if (!qSnap.exists || qSnap.data().status !== "queued") {
        throw new Error("Message already processed or invalid");
      }

      const cSnap = await t.get(churchRef);
      if (!cSnap.exists) throw new Error("Church not found");
      
      const churchData = cSnap.data();
      const balance = churchData.sms?.credits || 0;
      const cost = data.cost || 1;

      if (balance < cost) {
        throw new Error("Insufficient SMS credits");
      }

      // Deduct Credit & Update organizational stats
      const newBalance = balance - cost;
      t.update(churchRef, { 
        "sms.credits": newBalance,
        "sms.sent": admin.firestore.FieldValue.increment(1),
        "sms.lastSentAt": admin.firestore.FieldValue.serverTimestamp()
      });

      // Mark processing in queue
      t.update(queueRef, { 
        status: "processing", 
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      });

      // Record Transaction Ledger
      const txDoc = txRef.doc();
      t.set(txDoc, {
        type: "debit",
        amount: cost,
        balanceBefore: balance,
        balanceAfter: newBalance,
        reason: data.type || "queue_send",
        messageId: messageId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { balanceAfter: newBalance };
    });

    // 2. DISPATCH TO PROVIDER
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
      
      // Log for dashboard
      await logsRef.add({
        memberName: data.metadata?.memberName || "Recipient",
        memberId: data.metadata?.memberId,
        phone: data.phone,
        message: data.message,
        status: "sent",
        type: data.type,
        provider: "mnotify",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

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

    // Log failure for analytics
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

    return { success: false, error: error.message };
  }
}

module.exports = { queueSMS, processSMSQueueItem };
