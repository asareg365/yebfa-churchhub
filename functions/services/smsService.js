
const axios = require("axios");
const admin = require("firebase-admin");
const { formatPhone } = require("../utils/phoneFormatter");

/**
 * Centralized Enterprise SMS Service with Robust Accounting
 * Handles: Credit checks, mNotify delivery, balance deduction, and analytics.
 */
async function sendSMS(apiKey, churchId, payload) {
  const db = admin.firestore();
  const churchRef = db.collection("churches").doc(churchId);
  const logsRef = churchRef.collection("smsLogs");
  const txRef = churchRef.collection("smsTransactions");

  const { phone, message, type, memberName, memberId } = payload;
  const formattedPhone = formatPhone(phone);

  try {
    // 1. SECURITY & CREDIT GATEKEEPER
    const churchDoc = await churchRef.get();
    if (!churchDoc.exists) throw new Error("Organization not found");
    
    const churchData = churchDoc.data();
    const smsConfig = churchData.sms || { enabled: false, credits: 0, approved: false, sent: 0, failed: 0 };

    // Support both approved boolean and active string status
    const isApproved = smsConfig.approved === true || smsConfig.subscriptionStatus === 'active';

    if (!isApproved || !smsConfig.enabled) {
      const errorMsg = "SMS service is not active or approved for this account.";
      await logsRef.add({
        memberName: memberName || "System Gatekeeper",
        memberId: memberId || null,
        phone: formattedPhone || phone || "N/A",
        message: (message || "").substring(0, 100),
        status: "failed",
        error: errorMsg,
        type: type || "other",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: false, error: errorMsg };
    }

    if ((smsConfig.credits || 0) <= 0) {
      const errorMsg = "Insufficient SMS credits";
      await logsRef.add({
        memberName: memberName || "System Gatekeeper",
        memberId: memberId || null,
        phone: formattedPhone || phone || "N/A",
        message: (message || "").substring(0, 100),
        status: "failed",
        error: errorMsg,
        type: type || "other",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: false, error: errorMsg };
    }

    // 2. DISPATCH TO mNOTIFY
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const finalSenderId = "YEBFA"; // Hardcoded approved technical ID

    const response = await axios.post(url, {
      recipient: [formattedPhone],
      sender: finalSenderId,
      message: message,
      is_schedule: false
    }, { timeout: 15000 }).catch(err => {
       console.error("mNotify Network Error:", err.message);
       return { status: 500, data: { message: err.message } };
    });

    // mNotify success is typically HTTP 200 with code "1000" in body
    const isSent = response.status === 200 && (response.data.code === "1000" || response.data.status === "success");

    if (isSent) {
      // 3. ATOMIC ACCOUNTING (Only on Success)
      await db.runTransaction(async (t) => {
        const freshSnap = await t.get(churchRef);
        const currentCredits = freshSnap.data().sms?.credits || 0;
        
        t.update(churchRef, { 
          "sms.credits": admin.firestore.FieldValue.increment(-1),
          "sms.sent": admin.firestore.FieldValue.increment(1),
          "sms.lastSentAt": admin.firestore.FieldValue.serverTimestamp()
        });

        // Use transaction.set with a new doc ref instead of transaction.add
        const newTxRef = txRef.doc();
        t.set(newTxRef, {
          type: "debit",
          amount: 1,
          balanceBefore: currentCredits,
          balanceAfter: currentCredits - 1,
          reason: type || "manual_send",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      // 4. LOG SUCCESSFUL COMMUNICATION
      await logsRef.add({
        memberName: memberName || "Unknown",
        memberId: memberId || null,
        phone: formattedPhone,
        message,
        status: "sent",
        provider: "mnotify",
        type: type || "other",
        retryCount: payload.retryCount || 0,
        cost: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, data: response.data };
    } else {
      // 5. TRACK PROVIDER FAILURE
      await churchRef.update({
        "sms.failed": admin.firestore.FieldValue.increment(1)
      });

      await logsRef.add({
        memberName: memberName || "Unknown",
        memberId: memberId || null,
        phone: formattedPhone || phone,
        message: (message || "").substring(0, 160),
        status: "failed",
        error: response.data?.message || "Provider rejection",
        type: type || "other",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: false, error: response.data?.message || "Delivery failed by provider" };
    }

  } catch (error) {
    console.error(`[${churchId}] SMS Critical Error:`, error.message);
    
    // Log unexpected code errors to the logs collection so user sees them
    try {
      await churchRef.update({ "sms.failed": admin.firestore.FieldValue.increment(1) });
      await logsRef.add({
        memberName: memberName || "System Error",
        memberId: memberId || null,
        phone: phone || "N/A",
        message: message ? (message.substring(0, 50) + "...") : "N/A",
        status: "failed",
        error: error.message,
        type: type || "other",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (logErr) {
       console.error("Nested logging failure:", logErr.message);
    }
    
    return { success: false, error: error.message };
  }
}

module.exports = { sendSMS };
