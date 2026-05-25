
const admin = require("firebase-admin");
const { DateTime } = require("luxon");
const { queueSMS } = require("../services/smsService");

/**
 * Checks for events happening tomorrow and sends reminders via Queue.
 */
async function processEventReminders() {
  const db = admin.firestore();
  const churchesSnap = await db.collection("churches").get();

  for (const churchDoc of churchesSnap.docs) {
    const churchId = churchDoc.id;
    const churchData = churchDoc.data();
    const timezone = churchData.settings?.timezone || "Africa/Accra";
    
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

        await queueSMS(churchId, {
          phone: member.phone,
          message,
          type: "reminder",
          memberName: member.name,
          memberId: memDoc.id
        });
      }
    }
  }
}

module.exports = { processEventReminders };
