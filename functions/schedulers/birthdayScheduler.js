const admin = require("firebase-admin");
const { sendSMS } = require("../services/smsService");

/**
 * Process Birthdays for a SPECIFIC Church.
 * Architecture: Optimized for per-church execution via Cloud Scheduler.
 */
async function sendBirthdaySMS(apiKey, churchId) {
  const db = admin.firestore();

  if (!churchId) {
    console.error("sendBirthdaySMS: Missing churchId parameter.");
    return { success: false, error: "Missing churchId" };
  }

  const churchRef = db.collection("churches").doc(churchId);
  const churchDoc = await churchRef.get();

  if (!churchDoc.exists) {
    console.warn(`sendBirthdaySMS: Church ${churchId} not found.`);
    return { success: false, error: "Church not found" };
  }

  const churchData = churchDoc.data();

  // Safety check for disabled greetings
  if (churchData?.settings?.birthdaySmsEnabled === false) {
    console.log(`⛔ Skipped: Birthday SMS disabled for ${churchId}`);
    return { success: true, message: "Disabled" };
  }

  // Consistent MM-DD Key logic (UTC)
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const todayKey = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  console.log(`🟡 Birthday job triggered for ${churchId} (Key: ${todayKey})`);

  // Fast Indexed Query
  const membersSnap = await churchRef.collection("members")
    .where("birthdayKey", "==", todayKey)
    .get();

  if (membersSnap.empty) {
    console.log(`ℹ️ No celebrants today in ${churchId}`);
    return { success: true, count: 0 };
  }

  const results = { sent: 0, failed: 0 };

  for (const memberDoc of membersSnap.docs) {
    const member = memberDoc.data();

    if (!member.phone) continue;

    const message = `Happy Birthday ${member.name}! May God bless your new age with favor, health, and prosperity. — ${churchData.name || "Our Church"}`;

    try {
      const outcome = await sendSMS(apiKey, churchId, {
        phone: member.phone,
        message,
        type: "birthday",
        memberName: member.name,
        memberId: memberDoc.id,
        senderId: "YEBFA"
      });

      if (outcome.success) results.sent++;
      else results.failed++;
    } catch (err) {
      console.error(`❌ SMS failed for ${member.name} in ${churchId}:`, err.message);
      results.failed++;
    }
  }

  console.log(`✅ Completed ${churchId}: Sent ${results.sent}, Failed ${results.failed}`);
  return { success: true, ...results };
}

module.exports = { sendBirthdaySMS };
