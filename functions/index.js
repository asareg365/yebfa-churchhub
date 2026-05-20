
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
 * Multi-Tenant Birthday SMS Cloud Function for mNotify
 * Runs daily at 06:00 AM (Africa/Accra)
 */
exports.sendBirthdaySMS = functions.pubsub
  .schedule("every day 06:00")
  .timeZone("Africa/Accra")
  .onRun(async (context) => {
    const db = admin.firestore();
    
    // Get current date components in Africa/Accra timezone
    const today = new Date(new Date().toLocaleString("en-US", {timeZone: "Africa/Accra"}));
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // 1. Get all active churches
    const churchesSnapshot = await db.collection("churches").get();
    const allSmsPromises = [];

    for (const churchDoc of churchesSnapshot.docs) {
      const churchData = churchDoc.data();
      const churchId = churchDoc.id;
      const churchName = churchData.name || "Our Church";

      // Skip churches with birthday SMS disabled explicitly
      if (churchData.settings && churchData.settings.birthdaySmsEnabled === false) {
        continue;
      }

      // 2. Get members for this specific church
      const membersSnapshot = await db.collection("churches").doc(churchId).collection("members").get();

      membersSnapshot.forEach((memberDoc) => {
        const member = memberDoc.data();
        if (!member.dateOfBirth || !member.phone) return;

        // Parse YYYY-MM-DD
        const [year, month, day] = member.dateOfBirth.split('-').map(Number);
        
        if (month === currentMonth && day === currentDay) {
          const message = `Happy Birthday ${member.name}! God bless your new age. — ${churchName}`;
          const rawPhone = member.phone;
          const phone = normalizePhone(rawPhone);

          allSmsPromises.push(
            (async () => {
              try {
                await sendMNotifySMS(phone, message, churchData);
                // Log in tenant's specific collection
                await db.collection("churches").doc(churchId).collection("smsLogs").add({
                  phone,
                  message,
                  status: "sent",
                  type: "birthday",
                  memberId: memberDoc.id,
                  memberName: member.name,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              } catch (error) {
                console.error(`[${churchName}] Failed SMS to ${member.name}:`, error.message);
                await db.collection("churches").doc(churchId).collection("smsLogs").add({
                  phone,
                  message,
                  status: "failed",
                  type: "birthday",
                  error: error.message,
                  memberId: memberDoc.id,
                  memberName: member.name,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
            })()
          );
        }
      });
    }

    await Promise.all(allSmsPromises);
    return null;
  });

/**
 * Manual Test Endpoint for Birthday SMS
 * Trigger this to test connectivity immediately.
 * Example: https://<region>-<project>.cloudfunctions.net/testBirthdaySMS?phone=0240000000
 */
exports.testBirthdaySMS = functions.https.onRequest(async (req, res) => {
  try {
    const rawPhone = req.query.phone || "0240000000";
    const phone = normalizePhone(rawPhone);
    const testSenderId = req.query.sender || "YEBFA";

    await sendMNotifySMS(
      phone,
      "Test SMS from Yebfa ChurchHub manual trigger with normalization.",
      { settings: { senderId: testSenderId } }
    );

    res.status(200).send(`Test SMS queued to normalized phone ${phone} with sender ${testSenderId}`);
  } catch (error) {
    console.error("Test SMS Error:", error);
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
    console.warn(`[SIMULATED SMS - No API Key] To: ${phone}, Sender: ${senderId}, Msg: ${message}`);
    return Promise.resolve({ success: true, simulated: true });
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
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    }
  );
}
