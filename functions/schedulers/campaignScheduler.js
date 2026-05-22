
const admin = require("firebase-admin");
const { queueSMS } = require("../services/smsService");

/**
 * Processes scheduled announcements and campaigns.
 */
async function processScheduledCampaigns(apiKey) {
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
      
      // Mark as processing
      await campDoc.ref.update({ status: "processing" });

      // Fetch target audience
      let membersSnap;
      if (campaign.target === "all members") {
        membersSnap = await churchDoc.ref.collection("members").where("status", "==", "Active").get();
      } else {
        membersSnap = await churchDoc.ref.collection("members")
          .where("department", "==", campaign.target)
          .where("status", "==", "Active")
          .get();
      }

      for (const memDoc of membersSnap.docs) {
        const member = memDoc.data();
        if (!member.phone) continue;

        // PUSH TO QUEUE
        await queueSMS(churchId, {
          phone: member.phone,
          message: campaign.message,
          type: "announcement",
          memberName: member.name,
          memberId: memDoc.id
        });
      }

      await campDoc.ref.update({ 
        status: "completed",
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
}

module.exports = { processScheduledCampaigns };
