const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");

admin.initializeApp();

/**
 * Define environment variables using the v2 Params API
 */
const MNOTIFY_API_KEY = defineString("MNOTIFY_API_KEY");
const MNOTIFY_SENDER_ID = defineString("MNOTIFY_SENDER_ID");

/**
 * Helper to normalize Ghana phone numbers to E.164 format (+233)
 */
function normalizePhone(phone) {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (cleaned.startsWith("0")) {
    return "+233" + cleaned.substring(1);
  }
  return cleaned;
}

const axios = require("axios");

/**
 * Modern mNotify SMS function with detailed logging
 */
async function sendMNotifySMS(phone, message, churchData) {
  const apiKey = MNOTIFY_API_KEY.value();
  const defaultSenderId = MNOTIFY_SENDER_ID.value();
  
  // Use church-specific senderId if available, otherwise global default
  const senderId = (churchData && churchData.settings && churchData.settings.senderId) || 
                   defaultSenderId || 
                   "ChurchHub";

  console.log("API KEY (masked):", apiKey.substring(0, 4) + "...");
  console.log("SENDER ID:", senderId);

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
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  console.log("mNotify response:", response.data);

  return response.data;
}

/**
 * Multi-Tenant Birthday SMS Cloud Function (v2)
 */
exports.sendBirthdaySMS = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "Africa/Accra",
  },
  async (event) => {
    console.log("Birthday SMS job started (v2)");
    const db = admin.firestore();

    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Used for duplicate prevention (start of today in Accra)
    const todayStr = new Date().toLocaleString("en-US", {timeZone: "Africa/Accra"});
    const startOfToday = new Date(todayStr);
    startOfToday.setHours(0, 0, 0, 0);

    const churchesSnap = await db.collection("churches").get();

    for (const churchDoc of churchesSnap.docs) {
      const churchData = churchDoc.data();
      const churchId = churchDoc.id;

      // Skip churches with birthday SMS explicitly disabled
      if (churchData.settings && churchData.settings.birthdaySmsEnabled === false) {
        continue;
      }

      const membersSnap = await db
        .collection("churches")
        .doc(churchId)
        .collection("members")
        .get();

      for (const memberDoc of membersSnap.docs) {
        const m = memberDoc.data();

        if (!m.dateOfBirth || !m.phone) continue;

        // DOB is expected in YYYY-MM-DD format
        const [year, mMonth, mDay] = m.dateOfBirth.split("-").map(Number);

        if (mMonth === month && mDay === day) {
          try {
            // Duplicate prevention: check if already sent today
            const existingLogs = await db.collection("churches")
              .doc(churchId)
              .collection("smsLogs")
              .where("memberId", "==", memberDoc.id)
              .where("type", "==", "birthday")
              .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfToday))
              .get();

            if (!existingLogs.empty) {
              continue;
            }

            const message = `Happy Birthday ${m.name}! God bless your new age. — ${churchData.name || 'Our Church'}`;
            const phone = normalizePhone(m.phone);

            await sendMNotifySMS(phone, message, churchData);
            
            await db.collection("churches").doc(churchId).collection("smsLogs").add({
              phone,
              message,
              status: "sent",
              type: "birthday",
              memberId: memberDoc.id,
              memberName: m.name,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          } catch (error) {
            console.error(`[${churchId}] Failed SMS to ${m.name}:`, error.message);
          }
        }
      }
    }

    return null;
  }
);

/**
 * Manual Test Endpoint for SMS (v2)
 */
exports.testBirthdaySMS = onRequest(async (req, res) => {
  try {
    const phone = normalizePhone(req.query.phone || "0240000000");
    const result = await sendMNotifySMS(
      phone, 
      "Test SMS from Yebfa ChurchHub manual v2 trigger.", 
      {}
    );

    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({
      message: "Manual test failed",
      error: error.message
    });
  }
});