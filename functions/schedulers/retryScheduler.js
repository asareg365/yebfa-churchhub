
const admin = require("firebase-admin");

/**
 * Exponential Backoff Strategy
 * Attempts: 1 (60s), 2 (120s), 3 (240s)...
 */
function getBackoffSeconds(retryCount) {
  return Math.min(60 * Math.pow(2, retryCount), 3600); // Max 1 hour
}

async function retryFailedSMS(apiKey) {
  const db = admin.firestore();
  
  // Query failed messages eligible for retry
  const failedQuery = await db.collection("smsQueue")
    .where("status", "==", "failed")
    .where("retryCount", "<", 5) // Max 5 attempts
    .limit(50)
    .get();

  if (failedQuery.empty) return { success: true, count: 0 };

  const batch = db.batch();
  let processed = 0;

  for (const doc of failedQuery.docs) {
    const data = doc.data();
    
    const lastUpdate = data.updatedAt?.toMillis() || Date.now();
    const waitTime = getBackoffSeconds(data.retryCount || 0) * 1000;

    if (Date.now() - lastUpdate >= waitTime) {
      batch.update(doc.ref, {
        status: "queued",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      processed++;
    }
  }

  await batch.commit();
  return { success: true, count: processed };
}

module.exports = { retryFailedSMS };
