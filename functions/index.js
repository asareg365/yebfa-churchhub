
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

/**
 * Multi-Tenant Birthday SMS Cloud Function
 * Runs daily at 06:00 AM (Africa/Accra)
 * Iterates through all churches, their members, and sends greetings.
 */
exports.sendBirthdaySMS = functions.pubsub
  .schedule("every day 06:00")
  .timeZone("Africa/Accra")
  .onRun(async (context) => {
    const db = admin.firestore();
    
    // Get current date components
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // 1. Get all churches
    const churchesSnapshot = await db.collection("churches").get();
    const allSmsPromises = [];

    for (const churchDoc of churchesSnapshot.docs) {
      const churchData = churchDoc.data();
      const churchId = churchDoc.id;
      const churchName = churchData.name || "Our Church";

      // Skip churches with birthday SMS disabled in settings
      if (churchData.settings?.birthdaySmsEnabled === false) continue;

      // 2. Get members for this specific church
      const membersSnapshot = await db.collection("churches").doc(churchId).collection("members").get();

      membersSnapshot.forEach((memberDoc) => {
        const member = memberDoc.data();
        if (!member.dateOfBirth || !member.phone) return;

        const dob = new Date(member.dateOfBirth);
        if (dob.getMonth() + 1 === currentMonth && dob.getDate() === currentDay) {
          const message = `Happy Birthday ${member.name}! God bless your new age. — ${churchName}`;
          const phone = member.phone;

          allSmsPromises.push(
            (async () => {
              try {
                await sendSMS(phone, message, churchData);
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
 * Helper function to send SMS via Hubtel API (Simulated if credentials missing)
 */
async function sendSMS(phone, message, churchData) {
  // Use global config if church doesn't have custom ones
  const clientId = functions.config().hubtel?.client_id;
  const clientSecret = functions.config().hubtel?.client_secret;
  const senderId = functions.config().hubtel?.sender_id || "YebfaHub";

  if (!clientId || !clientSecret) {
    // Simulated sending in development/unconfigured states
    console.log(`[SIMULATED SMS] To: ${phone}, Msg: ${message}`);
    return Promise.resolve({ success: true });
  }

  const url = "https://smsc.hubtel.com/v1/messages/send";
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  return axios.post(
    url,
    { from: senderId, to: phone, content: message },
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    }
  );
}
