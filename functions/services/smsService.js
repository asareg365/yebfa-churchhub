const axios = require("axios");
const admin = require("firebase-admin");
const { formatPhone } = require("../utils/phoneFormatter");

/**
 * Core SMS Sending Service with Credit Enforcement
 */
async function sendSMS(apiKey, churchId, payload) {
  const db = admin.firestore();
  const churchRef = db.collection("churches").doc(churchId);
  const logsRef = churchRef.collection("smsLogs");

  const { phone, message, type, memberName, memberId, senderId } = payload;
  const formattedPhone = formatPhone(phone);

  try {
    // 1. Validate Credits
    const churchDoc = await churchRef.get();
    const churchData = churchDoc.data();
    const sub = churchData.subscription || { smsCredits: 0, smsUsed: 0 };

    if (sub.smsUsed >= sub.smsCredits) {
      console.warn(`[${churchId}] Credits exhausted. Blocking send.`);
      return { success: false, error: "Insufficient credits" };
    }

    // 2. Prepare API Call
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const finalSenderId = senderId || (churchData.settings && churchData.settings.senderId) || "ChurchHub";

    const response = await axios.post(url, {
      recipient: [formattedPhone],
      sender: finalSenderId,
      message: message,
      is_schedule: false
    }, { timeout: 10000 });

    const isSent = response.status === 200;

    // 3. Log Result
    const logData = {
      memberName: memberName || "Unknown",
      memberId: memberId || null,
      phone: formattedPhone,
      message: message,
      status: isSent ? "sent" : "failed",
      provider: "mnotify",
      type: type || "other",
      retryCount: payload.retryCount || 0,
      cost: 1,
      providerResponse: response.data || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await logsRef.add(logData);

    // 4. Increment usage on success
    if (isSent) {
      await churchRef.update({
        "subscription.smsUsed": admin.firestore.FieldValue.increment(1)
      });
    }

    return { success: isSent, data: response.data };
  } catch (error) {
    console.error(`[${churchId}] SMS Service Error:`, error.message);
    
    // Log initial failure if not a credit error
    if (error.message !== "Insufficient credits") {
      await logsRef.add({
        memberName: memberName || "Unknown",
        phone: formattedPhone,
        message: message,
        status: "failed",
        error: error.message,
        type: type || "other",
        retryCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return { success: false, error: error.message };
  }
}

module.exports = { sendSMS };