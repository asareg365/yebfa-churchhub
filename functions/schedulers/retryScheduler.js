
const admin = require("firebase-admin");

/**
 * Retries failed SMS logs by placing them back into the global queue
 * instead of sending directly. This maintains the 'Charge-Then-Send' integrity.
 */
async function retryFailedSMS(apiKey) {
  const db = admin.firestore();
  const churchesSnap = await db.collection("churches").get();

  for (const churchDoc of churchesSnap.docs) {
    const churchId = churchDoc.id;

    // Query logs where status is failed and retryCount < 3
    const failedLogsSnap = await churchDoc.ref.collection("smsLogs")
      .where("status", "==", "failed")
      .where("retryCount", "<", 3)
      .limit(20)
      .get();

    if (failedLogsSnap.empty) continue;

    const queueRef = db.collection("smsQueue");

    for (const logDoc of failedLogsSnap.docs) {
      const log = logDoc.data();
      
      // Re-enqueue the message
      await queueRef.add({
        churchId,
        phone: log.phone,
        message: log.message,
        type: log.type,
        status: "queued",
        retryCount: (log.retryCount || 0) + 1,
        maxRetries: 3,
        cost: log.cost || 1,
        metadata: {
          memberId: log.memberId || null,
          memberName: log.memberName || null,
        },
        scheduledAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Remove the old failed log to keep history clean (a new one will be created)
      await logDoc.ref.delete();
    }
  }
  
  return { success: true };
}

module.exports = { retryFailedSMS };
