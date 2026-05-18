const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

/**
 * Automated Birthday SMS Cloud Function
 * Runs daily at 06:00 AM (Africa/Accra)
 * Iterates through members and sends a greeting if it's their birthday.
 */
exports.sendBirthdaySMS = functions.pubsub
  .schedule("every day 06:00")
  .timeZone("Africa/Accra")
  .onRun(async (context) => {
    const db = admin.firestore();
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // getMonth is 0-indexed
    const currentDay = today.getDate();

    const membersSnapshot = await db.collection("members").get();
    const smsPromises = [];

    membersSnapshot.forEach((doc) => {
      const member = doc.data();

      if (!member.dateOfBirth) return;

      const dob = new Date(member.dateOfBirth);
      const dobMonth = dob.getMonth() + 1;
      const dobDay = dob.getDate();

      if (dobMonth === currentMonth && dobDay === currentDay) {
        // Use member.name (matching the schema in backend.json)
        const name = member.name || "Beloved Member";
        const message = `Happy Birthday ${name}! God bless your new age. — Yebfa Church`;
        const phone = member.phone;

        if (phone) {
          smsPromises.push(
            (async () => {
              try {
                await sendSMS(phone, message);
                await db.collection("smsLogs").add({
                  phone,
                  message,
                  status: "sent",
                  memberId: doc.id,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              } catch (error) {
                console.error(`Failed to send SMS to ${name}:`, error.message);
                await db.collection("smsLogs").add({
                  phone,
                  message,
                  status: "failed",
                  error: error.message,
                  memberId: doc.id,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
            })()
          );
        }
      }
    });

    await Promise.all(smsPromises);
    return null;
  });

/**
 * Helper function to send SMS via Hubtel
 */
async function sendSMS(phone, message) {
  const clientId = functions.config().hubtel?.client_id;
  const clientSecret = functions.config().hubtel?.client_secret;
  const senderId = functions.config().hubtel?.sender_id || "YebfaChurch";

  if (!clientId || !clientSecret) {
    throw new Error("Hubtel credentials (client_id/client_secret) are not configured in Firebase environment.");
  }

  const url = "https://smsc.hubtel.com/v1/messages/send";
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  return axios.post(
    url,
    {
      From: senderId,
      To: phone,
      Content: message,
    },
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    }
  );
}
