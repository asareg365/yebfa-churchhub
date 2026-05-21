const admin = require("firebase-admin");
const { sendSMS } = require("../services/smsService");

/**
 * Daily Birthday SMS Scheduler
 * Optimized to use birthdayKey indexed query
 */
async function sendBirthdaySMS(apiKey) {
  const db = admin.firestore();

  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  
  // Format MM-DD for efficient indexed querying
  const todayKey = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  console.log(`🟡 Birthday job started for key: ${todayKey} (UTC)`);

  const churchesSnap = await db.collection("churches").get();

  for (const churchDoc of churchesSnap.docs) {
    const churchData = churchDoc.data();
    const churchId = churchDoc.id;

    if (churchData?.settings?.birthdaySmsEnabled === false) {
      console.log(`⛔ Skipped church (disabled): ${churchId}`);
      continue;
    }

    // OPTIMIZED: Query only members with birthdayKey matching today
    const membersSnap = await churchDoc.ref.collection("members")
      .where("birthdayKey", "==", todayKey)
      .get();

    if (membersSnap.empty) continue;

    console.log(`🎉 Found ${membersSnap.size} celebrants in ${churchId}`);

    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data();

      if (!member.phone) continue;

      const message = `Happy Birthday ${member.name}! May God bless your new age with favor, health, and prosperity. — ${churchData.name || "Our Church"}`;

      try {
        await sendSMS(apiKey, churchId, {
          phone: member.phone,
          message,
          type: "birthday",
          memberName: member.name,
          memberId: memberDoc.id,
          senderId: "YEBFA"
        });

        console.log(`✅ Birthday SMS sent to ${member.name}`);
      } catch (err) {
        console.error(`❌ SMS failed for ${member.name}:`, err.message);
      }
    }
  }

  console.log("🟢 Birthday job completed");
  return { success: true };
}

module.exports = { sendBirthdaySMS };
