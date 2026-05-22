
const admin = require("firebase-admin");
const { DateTime } = require("luxon");
const { sendSMS } = require("../services/smsService");
const { parseTemplate } = require("../utils/templateEngine");

/**
 * Processes automated follow-ups for visitors who came yesterday.
 */
async function processVisitorFollowups(apiKey) {
  const db = admin.firestore();
  const churchesSnap = await db.collection("churches").get();

  for (const churchDoc of churchesSnap.docs) {
    const churchId = churchDoc.id;
    const churchData = churchDoc.data();
    const timezone = churchData.settings?.timezone || "Africa/Accra";
    
    // Get "Yesterday" in church's local time
    const yesterday = DateTime.now().setZone(timezone).minus({ days: 1 }).toFormat("yyyy-MM-dd");

    const visitorsSnap = await churchDoc.ref.collection("visitors")
      .where("visitDate", "==", yesterday)
      .where("followupSent", "==", false)
      .get();

    for (const visDoc of visitorsSnap.docs) {
      const visitor = visDoc.data();
      const template = churchData.smsTemplates?.visitorFollowup || "Thank you for worshipping with us yesterday at {{churchName}}! We hope to see you again soon.";
      const churchDisplayName = churchData.sms?.displayName || churchData.name;

      const message = parseTemplate(template, {
        name: visitor.name,
        churchName: churchDisplayName
      });

      try {
        const result = await sendSMS(apiKey, churchId, {
          phone: visitor.phone,
          message,
          type: "followup",
          memberName: visitor.name
        });

        if (result.success) {
          await visDoc.ref.update({ followupSent: true });
        }
      } catch (e) {
        console.error(`Followup failed for visitor ${visDoc.id}:`, e.message);
      }
    }
  }
}

module.exports = { processVisitorFollowups };
