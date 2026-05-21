const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");

admin.initializeApp();

const MNOTIFY_API_KEY = defineString("MNOTIFY_API_KEY");
const MNOTIFY_SENDER_ID = defineString("MNOTIFY_SENDER_ID");

/**
 * Enterprise mNotify SMS function with detailed logging
 */
async function sendMNotifySMS(phone, message, churchData) {
  const apiKey = MNOTIFY_API_KEY.value();
  const defaultSenderId = MNOTIFY_SENDER_ID.value();
  
  const senderId = (churchData && churchData.settings && churchData.settings.senderId) || 
                   defaultSenderId || 
                   "ChurchHub";

  const axios = require("axios");
  const response = await axios.post(
    "https://api.mnotify.com/api/sms/quick",
    {
      key: apiKey,
      recipient: [phone],
      sender: senderId,
      message: message,
      is_schedule: false
    },
    {
      headers: { "Content-Type": "application/json" }
    }
  );

  console.log("mNotify response:", response.data);
  return response.data;
}

/**
 * Multi-Tenant Birthday SMS Scheduler (v2)
 */
exports.sendBirthdaySMS = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "Africa/Accra",
  },
  async (event) => {
    const db = admin.firestore();
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const churchesSnap = await db.collection("churches").get();

    for (const churchDoc of churchesSnap.docs) {
      const churchData = churchDoc.data();
      const churchId = churchDoc.id;

      if (churchData.settings && churchData.settings.birthdaySmsEnabled === false) continue;

      const sub = churchData.subscription || { smsCredits: 0, smsUsed: 0 };
      if (sub.smsUsed >= sub.smsCredits) continue;

      const membersSnap = await db.collection("churches").doc(churchId).collection("members").get();

      for (const memberDoc of membersSnap.docs) {
        const m = memberDoc.data();
        if (!m.dateOfBirth || !m.phone) continue;

        const [mYear, mMonth, mDay] = m.dateOfBirth.split("-").map(Number);

        if (mMonth === month && mDay === day) {
          try {
            const message = `Happy Birthday ${m.name}! God bless your new age. — ${churchData.name || 'Our Church'}`;
            const result = await sendMNotifySMS(m.phone, message, churchData);
            
            await db.collection("churches").doc(churchId).collection("smsLogs").add({
              phone: m.phone,
              message,
              status: "sent",
              type: "birthday",
              memberId: memberDoc.id,
              memberName: m.name,
              provider: "mNotify",
              cost: 1,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            await db.collection("churches").doc(churchId).update({
              "subscription.smsUsed": admin.firestore.FieldValue.increment(1)
            });
          } catch (error) {
            console.error(`[${churchId}] Failed Birthday SMS to ${m.name}:`, error.message);
          }
        }
      }
    }
    return null;
  }
);

/**
 * Enterprise SMS Retry Scheduler (v2)
 * Runs every hour to retry pending/failed messages with < 3 retries
 */
exports.smsRetryEngine = onSchedule(
  {
    schedule: "0 * * * *", 
    timeZone: "Africa/Accra",
  },
  async (event) => {
    const db = admin.firestore();
    const churchesSnap = await db.collection("churches").get();

    for (const churchDoc of churchesSnap.docs) {
      const churchId = churchDoc.id;
      const churchData = churchDoc.data();

      const failedLogs = await db.collection("churches")
        .doc(churchId)
        .collection("smsLogs")
        .where("status", "==", "failed")
        .where("retryCount", "<", 3)
        .limit(20)
        .get();

      for (const logDoc of failedLogs.docs) {
        const log = logDoc.data();
        try {
          await sendMNotifySMS(log.phone, log.message, churchData);
          
          await logDoc.ref.update({
            status: "sent",
            retryCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          await db.collection("churches").doc(churchId).update({
            "subscription.smsUsed": admin.firestore.FieldValue.increment(1)
          });
        } catch (error) {
          await logDoc.ref.update({
            retryCount: admin.firestore.FieldValue.increment(1),
            error: error.message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }
    return null;
  }
);

/**
 * Billing Renewal Scheduler (v2)
 * Resets smsUsed monthly on the renewal date
 */
exports.billingRenewalEngine = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Africa/Accra",
  },
  async (event) => {
    const db = admin.firestore();
    const todayStr = new Date().toISOString().split('T')[0];

    const churchesSnap = await db.collection("churches").where("subscription.renewalDate", "==", todayStr).get();

    for (const churchDoc of churchesSnap.docs) {
      const data = churchDoc.data();
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + 1);
      
      await churchDoc.ref.update({
        "subscription.smsUsed": 0,
        "subscription.renewalDate": nextDate.toISOString().split('T')[0]
      });
      console.log(`Renewed subscription for ${churchDoc.id}`);
    }
    return null;
  }
);
