
const axios = require("axios");
const admin = require("firebase-admin");
const { formatPhone } = require("../utils/phoneFormatter");

/**
 * Enterprise SMS Service with Credit & Approval Enforcement
 */
async function sendSMS(apiKey, churchId, payload) {
  const db = admin.firestore();
  const churchRef = db.collection("churches").doc(churchId);
  const logsRef = churchRef.collection("smsLogs");
  const txRef = churchRef.collection("smsTransactions");

  const { phone, message, type, memberName, memberId } = payload;
  const formattedPhone = formatPhone(phone);

  try {
    // 1. Validate Church Status & Credits
    const churchDoc = await churchRef.get();
    if (!churchDoc.exists) throw new Error("Organization not found");
    
    const churchData = churchDoc.data();
    const smsConfig = churchData.sms || { enabled: false, credits: 0, approved: false };

    // Support both approved boolean and active string status for robustness
    const isApproved = smsConfig.approved === true || smsConfig.subscriptionStatus === 'active';

    if (!isApproved || !smsConfig.enabled) {
      return { success: false, error: "SMS service is not active or approved for this account." };
    }

    if (smsConfig.credits <= 0) {
      console.warn(`[${churchId}] Credits exhausted. Blocking send.`);
      return { success: false, error: "Insufficient SMS credits" };
    }

    // 2. Prepare API Call (mNotify)
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const finalSenderId = "YEBFA"; // SaaS Shared Approved Sender ID

    const response = await axios.post(url, {
      recipient: [formattedPhone],
      sender: finalSenderId,
      message: message,
      is_schedule: false
    }, { timeout: 10000 });

    const isSent = response.status === 200;

    if (isSent) {
      const balanceBefore = smsConfig.credits;
      const balanceAfter = balanceBefore - 1;

      // 3. Atomically deduct credit & log transaction
      await db.runTransaction(async (t) => {
        t.update(churchRef, { "sms.credits": balanceAfter });
        t.add(txRef, {
          type: "debit",
          amount: 1,
          balanceBefore,
          balanceAfter,
          reason: type || "manual_send",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
    }

    // 4. Log Communication Result
    await logsRef.add({
      memberName: memberName || "Unknown",
      memberId: memberId || null,
      phone: formattedPhone,
      message,
      status: isSent ? "sent" : "failed",
      provider: "mnotify",
      type: type || "other",
      retryCount: payload.retryCount || 0,
      cost: isSent ? 1 : 0,
      providerResponse: response.data || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: isSent, data: response.data };

  } catch (error) {
    console.error(`[${churchId}] SMS Service Error:`, error.message);
    
    // Log failure for audit trail if it wasn't a pre-check error
    if (!["Insufficient SMS credits", "Organization not found"].includes(error.message)) {
      await logsRef.add({
        memberName: memberName || "Unknown",
        phone: formattedPhone,
        message,
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
