
const admin = require("firebase-admin");
const { DateTime } = require("luxon");
const { queueSMS } = require("../services/smsService");
const { parseTemplate } = require("../utils/templateEngine");

/**
 * Global Birthday Dispatcher (Enterprise Scale)
 * Uses indexed birthdayKey (MMDD) for fast retrieval.
 */
async function dispatchAllBirthdays(apiKey) {
  const db = admin.firestore();
  
  const churchesSnap = await db.collection("churches")
    .where("settings.birthdaySmsEnabled", "==", true)
    .get();

  for (const churchDoc of churchesSnap.docs) {
    try {
      await processChurchBirthdays(churchDoc);
    } catch (err) {
      console.error(`Error processing birthdays for ${churchDoc.id}:`, err.message);
    }
  }
}

async function processChurchBirthdays(churchDoc) {
  const churchId = churchDoc.id;
  const churchData = churchDoc.data();
  const timezone = churchData.settings?.timezone || "Africa/Accra";
  
  // Use MMDD format for indexed query
  const now = DateTime.now().setZone(timezone);
  const todayKey = now.toFormat("MMdd");
  const todayDateStr = now.toFormat("yyyy-MM-dd");

  const membersSnap = await churchDoc.ref.collection("members")
    .where("birthdayKey", "==", todayKey)
    .get();

  if (membersSnap.empty) return;

  const template = churchData.smsTemplates?.birthday || "Happy Birthday {{name}}! May God bless your new age richly. — {{churchName}}";

  for (const memberDoc of membersSnap.docs) {
    const member = memberDoc.data();
    if (!member.phone) continue;

    // Idempotency Check (History record for visibility)
    const historyId = `bday_${memberDoc.id}_${todayDateStr}`;
    const historyRef = churchDoc.ref.collection("birthdayHistory").doc(historyId);
    const alreadyQueued = await historyRef.get();

    if (alreadyQueued.exists) continue;

    const message = parseTemplate(template, {
      name: member.name,
      churchName: churchData.sms?.displayName || churchData.name || "Our Church"
    });

    // PUSH TO GLOBAL QUEUE WITH DEDUPE KEY
    // This key guarantees zero duplicates even if the queue worker crashes and restarts.
    const result = await queueSMS(churchId, {
      phone: member.phone,
      message,
      type: "birthday",
      memberName: member.name,
      memberId: memberDoc.id,
      dedupeKey: `birthday_${churchId}_${memberDoc.id}_${todayDateStr}`
    });

    // Record history if enqueued successfully or skipped as duplicate
    if (result.success) {
      await historyRef.set({
        queuedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: result.skipped ? "skipped_duplicate" : "queued",
        dedupeKey: `birthday_${churchId}_${memberDoc.id}_${todayDateStr}`
      });
    }
  }
}

module.exports = { dispatchAllBirthdays };
