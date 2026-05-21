const admin = require("firebase-admin");
const { sendSMS } = require("../services/smsService");

/**
 * Retries failed SMS logs that haven't exceeded retry limits
 */
async function retryFailedSMS(apiKey) {
  const db = admin.firestore();
  const churchesSnap = await db.collection("churches").get();

  for (const churchDoc of churchesSnap.docs) {
    const churchId = churchDoc.id;
    const churchData = churchDoc.data();

    // Query logs where status is failed and retryCount < 3
    const failedLogsSnap = await churchDoc.ref.collection("smsLogs")
      .where("status", "==", "failed")
      .where("retryCount", "<", 3)
      .limit(20) // Batch processing
      .get();

    for (const logDoc of failedLogsSnap.docs) {
      const log = logDoc.data();
      
      const result = await sendSMS(apiKey, churchId, {
        phone: log.phone,
        message: log.message,
        type: log.type,
        memberName: log.memberName,
        memberId: log.memberId,
        retryCount: (log.retryCount || 0) + 1,
        senderId: churchData.settings?.senderId
      });

      if (result.success) {
        // Remove the old failed log after successful resend
        await logDoc.ref.delete();
      } else {
        // Update the log with the new retry count and error
        await logDoc.ref.update({
          retryCount: admin.firestore.FieldValue.increment(1),
          error: result.error,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }
  
  return null;
}

module.exports = { retryFailedSMS };
