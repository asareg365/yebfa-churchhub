const admin = require("firebase-admin");

/**
 * Advanced Retry Processor
 * Finds messages marked for retry whose backoff time has elapsed.
 */
async function retryFailedSMS() {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  
  const retryQuery = await db.collection("smsQueue")
    .where("status", "==", "queued_retry")
    .where("nextRetryAt", "<=", now)
    .where("retryCount", "<", 5)
    .limit(100)
    .get();

  if (retryQuery.empty) return { success: true, count: 0 };

  const batch = db.batch();
  let processed = 0;

  for (const doc of retryQuery.docs) {
    batch.update(doc.ref, {
      status: "queued",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    processed++;
  }

  await batch.commit();
  return { success: true, count: processed };
}

module.exports = { retryFailedSMS };