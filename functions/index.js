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
    
    // Get current date in Accra timezone context
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // getMonth is 0-indexed
    const currentDay = today.getDate();

    const membersSnapshot = await db.collection("members").get();
    const smsPromises = [];

    membersSnapshot.forEach((doc) => {
      const member = doc.data();

      if (!member.dateOfBirth) return;

      // Expecting YYYY-MM-DD format from the schema
      const dob = new Date(member.dateOfBirth);
      const dobMonth = dob.getMonth() + 1;
      const dobDay = dob.getDate();

      // Compare month and day
      if (dobMonth === currentMonth && dobDay === currentDay) {
        const name = member.name || "Beloved Member";
        const message = `Happy Birthday ${name}! God bless your new age. — Yebfa Church`;
        const phone = member.phone; // Assuming phone exists on the document

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
 * Helper function to send SMS via Hubtel SMS Regular API
 * Reference: https://smsc.hubtel.com/v1/messages/send
 */
async function sendSMS(phone, message) {
  const clientId = functions.config().hubtel?.client_id;
  const clientSecret = functions.config().hubtel?.client_secret;
  const senderId = functions.config().hubtel?.sender_id || "YebfaChurch";

  if (!clientId || !clientSecret) {
    throw new Error("Hubtel credentials (client_id/client_secret) are not configured in Firebase functions:config.");
  }

  const url = "https://smsc.hubtel.com/v1/messages/send";
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  return axios.post(
    url,
    {
      from: senderId,
      to: phone,
      content: message,
    },
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    }
  );
}
