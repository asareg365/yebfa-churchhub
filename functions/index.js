
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

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

/**
 * Multi-Tenant Birthday SMS Cloud Function
 * Using clean v1 syntax as requested.
 */
exports.sendBirthdaySMS = functions.pubsub
  .schedule("0 6 * * *")
  .timeZone("Africa/Accra")
  .onRun(async () => {
    console.log("Birthday SMS job started");
    const db = admin.firestore();

    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Used for duplicate prevention (start of today in Accra)
    const todayStr = new Date().toLocaleString("en-US", {timeZone: "Africa/Accra"});
    const startOfToday = new Date(todayStr);
    startOfToday.setHours(0, 0, 0, 0);

    const churches = await db.collection("churches").get();
    console.log("Churches found:", churches.size);

    for (const church of churches.docs) {
      const churchData = church.data();
      const churchId = church.id;
      const churchName = churchData.name || "Our Church";

      // Skip churches with birthday SMS disabled
      if (churchData.settings && churchData.settings.birthdaySmsEnabled === false) {
        continue;
      }

      console.log(`Processing birthdays for ${churchName}`);

      const members = await db
        .collection("churches")
        .doc(churchId)
        .collection("members")
        .get();

      for (const memberDoc of members.docs) {
        const m = memberDoc.data();

        if (!m.dateOfBirth || !m.phone) continue;

        // Use the requested Date comparison logic
        const dob = new Date(m.dateOfBirth);

        if (
          dob.getMonth() + 1 === month &&
          dob.getDate() === day
        ) {
          console.log("Birthday match:", m.name);

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
              console.log(`Already sent today for ${m.name}, skipping.`);
              continue;
            }

            const message = `Happy Birthday ${m.name}! God bless your new age. — ${churchName}`;
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
            console.error(`[${churchName}] Failed SMS to ${m.name}:`, error.message);
          }
        }
      }
    }

    console.log("Birthday SMS job finished");
    return null;
  });

/**
 * Manual Test Endpoint for Birthday SMS
 */
exports.testBirthdaySMS = functions.https.onRequest(async (req, res) => {
  try {
    const rawPhone = req.query.phone || "0240000000";
    const phone = normalizePhone(rawPhone);
    const testSenderId = req.query.sender || "YEBFA";

    await sendMNotifySMS(
      phone,
      "Test SMS from Yebfa ChurchHub manual trigger.",
      { settings: { senderId: testSenderId } }
    );

    res.status(200).send(`Test SMS sent to ${phone}`);
  } catch (error) {
    res.status(500).send(`Manual test failed: ${error.message}`);
  }
});

/**
 * Helper function to send SMS via mNotify API
 */
async function sendMNotifySMS(phone, message, churchData) {
  const config = functions.config().mnotify;
  const apiKey = config && config.api_key;
  const senderId = (churchData.settings && churchData.settings.senderId) || 
                   (config && config.sender_id) || 
                   "ChurchHub";

  if (!apiKey) {
    console.warn(`[SIMULATED SMS] To: ${phone}, Sender: ${senderId}, Msg: ${message}`);
    return Promise.resolve({ success: true });
  }

  const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;

  return axios.post(
    url,
    {
      recipient: [phone],
      sender: senderId,
      message: message,
      is_schedule: false
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    }
  );
}
