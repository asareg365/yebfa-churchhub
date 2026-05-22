
const admin = require("firebase-admin");
const { DateTime } = require("luxon");
const { sendSMS } = require("../services/smsService");
const { parseTemplate } = require("../utils/templateEngine");

/**
 * Global Birthday Dispatcher
 * Iterates through all churches and triggers birthday processing.
 */
async function dispatchAllBirthdays(apiKey) {
  const db = admin.firestore();
  console.log("🚀 Starting Global Birthday Dispatcher...");

  const churchesSnap = await db.collection("churches")
    .where("settings.birthdaySmsEnabled", "==", true)
    .get();

  console.log(`Found ${churchesSnap.size} churches with birthday SMS enabled.`);

  const results = { churchesProcessed: 0, totalSent: 0, totalFailed: 0 };

  for (const churchDoc of churchesSnap.docs) {
    try {
      const outcome = await processChurchBirthdays(apiKey, churchDoc);
      results.churchesProcessed++;
      results.totalSent += outcome.sent;
      results.totalFailed += outcome.failed;
    } catch (err) {
      console.error(`Error processing church ${churchDoc.id}:`, err.message);
    }
  }

  return results;
}

/**
 * Per-Church Worker Logic
 * Processes one church with timezone awareness and duplicate protection.
 */
async function processChurchBirthdays(apiKey, churchDoc) {
  const db = admin.firestore();
  const churchId = churchDoc.id;
  const churchData = churchDoc.data();
  const timezone = churchData.settings?.timezone || "Africa/Accra";
  
  // 1. Determine local "Today" for this church (UTC-based logic)
  const now = DateTime.now().setZone(timezone);
  const todayKey = now.toFormat("MM-dd");
  const todayDateStr = now.toFormat("yyyy-MM-dd");

  console.log(`[${churchId}] Processing birthdays for ${todayKey} (Timezone: ${timezone})`);

  // 2. Query only members celebrating today (Indexed Query)
  const membersSnap = await churchDoc.ref.collection("members")
    .where("birthdayKey", "==", todayKey)
    .get();

  if (membersSnap.empty) {
    return { sent: 0, failed: 0 };
  }

  const results = { sent: 0, failed: 0 };
  
  // 3. Resolve Template & Branding
  const template = churchData.smsTemplates?.birthday || "Happy Birthday {{name}}! May God bless your new age richly. — {{churchName}}";
  const churchDisplayName = churchData.sms?.displayName || churchData.name || "Our Church";

  for (const memberDoc of membersSnap.docs) {
    const member = memberDoc.data();
    const memberId = memberDoc.id;

    if (!member.phone) continue;

    // 4. Duplicate Protection (Idempotency)
    const historyId = `${memberId}_${todayDateStr}`;
    const historyRef = churchDoc.ref.collection("birthdayHistory").doc(historyId);
    const alreadySent = await historyRef.get();

    if (alreadySent.exists) {
      console.log(`[${churchId}] Greeting already sent to ${member.name} for ${todayDateStr}. Skipping.`);
      continue;
    }

    // 5. Personalize Message
    const message = parseTemplate(template, {
      name: member.name,
      churchName: churchDisplayName
    });

    // 6. Send through Centralized Service (Handles all accounting)
    try {
      const outcome = await sendSMS(apiKey, churchId, {
        phone: member.phone,
        message,
        type: "birthday",
        memberName: member.name,
        memberId: memberId
      });

      if (outcome.success) {
        await historyRef.set({
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          phone: member.phone,
          status: "success"
        });
        results.sent++;
      } else {
        results.failed++;
      }
    } catch (err) {
      console.error(`[${churchId}] Failed to send to ${member.name}:`, err.message);
      results.failed++;
    }
  }

  return results;
}

module.exports = { dispatchAllBirthdays, processChurchBirthdays };
