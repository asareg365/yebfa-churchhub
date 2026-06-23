const admin = require("firebase-admin");
const { queueSMS } = require("../services/smsService");

/**
 * Processes scheduled announcements and campaigns.
 */
async function processScheduledCampaigns() {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const churchesSnap = await db.collection("churches").get();

  for (const churchDoc of churchesSnap.docs) {
    const churchId = churchDoc.id;
    
    const campaignsSnap = await churchDoc.ref.collection("scheduledSms")
      .where("status", "==", "pending")
      .where("scheduledAt", "<=", now)
      .get();

    for (const campDoc of campaignsSnap.docs) {
      const campaign = campDoc.data();
      
      try {
        await campDoc.ref.update({ status: "processing" });

        let membersSnap;
        if (campaign.target === "all members") {
          membersSnap = await churchDoc.ref.collection("members").where("status", "==", "Active").get();
        } else {
          membersSnap = await churchDoc.ref.collection("members")
            .where("department", "==", campaign.target)
            .where("status", "==", "Active")
            .get();
        }

        if (membersSnap.empty) {
          await campDoc.ref.update({ status: "completed", result: "No active members found for target." });
          continue;
        }

        let successCount = 0;
        let failCount = 0;

        for (const memDoc of membersSnap.docs) {
          const member = memDoc.data();
          if (!member.phone) continue;

          const result = await queueSMS(churchId, {
            phone: member.phone,
            message: campaign.message,
            type: "announcement",
            memberName: member.name,
            memberId: memDoc.id
          });

          if (result.success) successCount++;
          else failCount++;
        }

        await campDoc.ref.update({ 
          status: "completed",
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          stats: { success: successCount, failed: failCount }
        });

      } catch (error) {
        console.error(`Error processing campaign ${campDoc.id}:`, error.message);
        await campDoc.ref.update({ 
          status: "failed", 
          error: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }
}

module.exports = { processScheduledCampaigns };