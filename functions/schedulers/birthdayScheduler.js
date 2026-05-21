const admin = require("firebase-admin");
const { sendSMS } = require("../services/smsService");

/**
 * Logic to process all daily birthdays across all church tenants
 */
async function sendBirthdaySMS(apiKey) {
  const db = admin.firestore();
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const churchesSnap = await db.collection("churches").get();

  for (const churchDoc of churchesSnap.docs) {
    const churchData = churchDoc.data();
    const churchId = churchDoc.id;

    // Skip if feature disabled
    if (churchData.settings && churchData.settings.birthdaySmsEnabled === false) continue;

    // Fetch members with birthdays today
    const membersSnap = await churchDoc.ref.collection("members").get();

    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data();
      if (!member.dateOfBirth || !member.phone) continue;

      const [mYear, mMonth, mDay] = member.dateOfBirth.split("-").map(Number);

      if (mMonth === month && mDay === day) {
        const message = `Happy Birthday ${member.name}! May God bless your new age with favor, health, and prosperity. — ${churchData.name || "Our Church"}`;
        
        await sendSMS(apiKey, churchId, {
          phone: member.phone,
          message: message,
          type: "birthday",
          memberName: member.name,
          memberId: memberDoc.id,
          senderId: churchData.settings?.senderId
        });
      }
    }
  }
  
  return null;
}

module.exports = { sendBirthdaySMS };
