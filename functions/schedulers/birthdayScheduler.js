const admin = require("firebase-admin");
const { sendSMS } = require("../services/smsService");

async function sendBirthdaySMS(apiKey) {
  const db = admin.firestore();

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  console.log(`🟡 Birthday job started for ${month}/${day}`);

  const churchesSnap = await db.collection("churches").get();

  console.log(`🏢 Churches found: ${churchesSnap.size}`);

  for (const churchDoc of churchesSnap.docs) {
    const churchData = churchDoc.data();
    const churchId = churchDoc.id;

    console.log(`➡️ Processing church: ${churchId}`);

    if (churchData?.settings?.birthdaySmsEnabled === false) {
      console.log(`⛔ Skipped (disabled): ${churchId}`);
      continue;
    }

    const membersSnap = await churchDoc.ref.collection("members").get();

    console.log(`👥 Members in ${churchId}: ${membersSnap.size}`);

    for (const memberDoc of membersSnap.docs) {
      const member = memberDoc.data();

      if (!member.dateOfBirth || !member.phone) {
        console.log(`⚠️ Skipped member (missing data): ${memberDoc.id}`);
        continue;
      }

      const dob = new Date(member.dateOfBirth);

      const mMonth = dob.getMonth() + 1;
      const mDay = dob.getDate();

      console.log(`🔍 Checking ${member.name}: ${mMonth}/${mDay}`);

      if (mMonth === month && mDay === day) {
        console.log(`🎉 Birthday match found: ${member.name}`);

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

          console.log(`✅ SMS sent to ${member.name}`);
        } catch (err) {
          console.error(`❌ SMS failed for ${member.name}:`, err.message);
        }
      }
    }
  }

  console.log("🟢 Birthday job completed");
  return { success: true };
}

module.exports = { sendBirthdaySMS };