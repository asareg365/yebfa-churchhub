const admin = require("firebase-admin");
const { DateTime } = require("luxon");
const { sendSMS } = require("../services/smsService");
const { parseTemplate } = require("../utils/templateEngine");

/**
 * Checks for events happening tomorrow and sends reminders.
 */
async function processEventReminders(apiKey) {
  const db = admin.firestore();
  const churchesSnap = await db.collection("churches").get();

  for (const churchDoc of churchesSnap.docs) {
    const churchId = churchDoc.id;
    const churchData = churchDoc.data();
    const timezone = churchData.settings?.timezone || "Africa/Accra";
    
    // Luxon tomorrow check
    const tomorrow = DateTime.now().setZone(timezone).plus({ days: 1 }).toFormat("yyyy-MM-dd");

    const eventsSnap = await churchDoc.ref.collection("events")
      .where("date", "==", tomorrow)
      .where("smsReminderEnabled", "==", true)
      .get();

    if (eventsSnap.empty) continue;

    const membersSnap = await churchDoc.ref.collection("members")
      .where("status", "==", "Active")
      .get();

    for (const eventDoc of eventsSnap.docs) {
      const event = eventDoc.data();
      const message = `Reminder: our event "${event.title}" is happening tomorrow at ${event.time}, ${event.location}. See you there! — ${churchData.sms?.displayName || churchData.name}`;

      for (const memDoc of membersSnap.docs) {
        const member = memDoc.data();
        if (!member.phone) continue;

        try {
          await sendSMS(apiKey, churchId, {
            phone: member.phone,
            message,
            type: "reminder",
            memberName: member.name,
            memberId: memDoc.id
          });
        } catch (e) {
          console.error(`Reminder failed for ${member.name} (Event: ${event.title})`);
        }
      }
    }
  }
}

module.exports = { processEventReminders };
