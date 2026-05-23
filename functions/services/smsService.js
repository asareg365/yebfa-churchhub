
const axios = require("axios");
const crypto = require("crypto");
const admin = require("firebase-admin");
const { formatPhone } = require("../utils/phoneFormatter");

const MAX_MESSAGE_LENGTH = 700;
const SPAM_KEYWORDS = ["bitcoin", "crypto", "investment", "prize", "won", "password", "otp", "lottery", "claim", "verify"];

/**
 * PRODUCTION-GRADE ERROR CLASSIFICATION
 */
function isRetryableError(errorMessage = "") {
  const msg = errorMessage.toLowerCase();
  const permanentFailures = [
    "insufficient sms credits",
    "service not approved",
    "invalid phone",
    "invalid recipient",
    "blocked",
    "spam",
    "blacklist",
    "message too long"
  ];
  return !permanentFailures.some(e => msg.includes(e));
}

/**
 * EXPONENTIAL BACKOFF CALCULATION
 */
function getBackoffDelay(retryCount) {
  const base = 60000; // 1 minute
  const max = 3600000; // 1 hour
  return Math.min(base * Math.pow(2, retryCount), max);
}

/**
 * ABUSE DETECTION
 */
function isPotentiallyMalicious(message) {
  const normalized = (message || "").toLowerCase().replace(/[^a-z0-9 ]/g, "");
  return SPAM_KEYWORDS.some(keyword => normalized.includes(keyword));
}

/**
 * Audit Logger for SMS events
 */
async function logSmsEvent(type, churchId, payload = {}) {
  try {
    await admin.firestore().collection("smsAuditLogs").add({
      type,
      churchId,
      payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Audit Logging Error:", err.message);
  }
}

/**
 * Distributed Locking
 */
async function acquireLock(db, churchId, messageId) {
  const lockRef = db.collection("smsLocks").doc(churchId);
  const now = Date.now();

  await db.runTransaction(async (t) => {
    const snap = await t.get(lockRef);
    const existing = snap.exists ? snap.data() : null;

    if (existing?.locked && existing.expiresAt > now) {
      throw new Error("LOCKED: Organization is currently processing another SMS.");
    }

    t.set(lockRef, {
      locked: true,
      churchId,
      messageId,
      expiresAt: now + 60000,
      version: now
    });
  });
}

async function releaseLock(db, churchId) {
  try {
    await db.collection("smsLocks").doc(churchId).delete();
  } catch (e) {}
}

/**
 * Transactional Wallet Debit
 */
async function debitWalletTx(t, db, churchId, cost, messageId, type) {
  const ledgerId = `${churchId}_${messageId}`;
  const ledgerRef = db.collection("smsLedger").doc(ledgerId);
  const walletRef = db.collection("smsWallets").doc(churchId);
  const churchRef = db.collection("churches").doc(churchId);

  const [ledgerSnap, walletSnap] = await Promise.all([
    t.get(ledgerRef),
    t.get(walletRef)
  ]);

  if (ledgerSnap.exists) {
    const existing = ledgerSnap.data();
    if (["COMMITTED", "SENT", "SUBMITTED"].includes(existing.status)) return;
  }

  const wallet = walletSnap.exists ? walletSnap.data() : { balance: 0 };
  const balance = Number(wallet.balance || 0);

  if (balance < cost) throw new Error("Insufficient SMS credits");

  const newBalance = balance - cost;
  const smsType = type || "general";

  t.set(walletRef, {
    balance: newBalance,
    totalSpent: admin.firestore.FieldValue.increment(cost),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  t.update(churchRef, {
    "sms.credits": newBalance,
    "sms.lastSentAt": admin.firestore.FieldValue.serverTimestamp(),
    "sms.stats.sent": admin.firestore.FieldValue.increment(1),
    [`sms.stats.${smsType}`]: admin.firestore.FieldValue.increment(1)
  });

  t.set(ledgerRef, {
    churchId,
    messageId,
    type: "DEBIT",
    amount: cost,
    smsType: smsType,
    status: "COMMITTED",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Mission Critical SMS Pipeline
 */
async function processSMSQueueItem(apiKey, messageId, data) {
  const db = admin.firestore();
  const churchId = data.churchId;
  const cost = data.cost || 1;
  const ledgerId = `${churchId}_${messageId}`;
  const logRef = db.collection("churches").doc(churchId).collection("smsLogs").doc(messageId);

  try {
    const earlyLedger = await db.collection("smsLedger").doc(ledgerId).get();
    if (earlyLedger.exists && ["SENT", "COMMITTED", "SUBMITTED"].includes(earlyLedger.data().status)) {
      return { skipped: true, reason: "already_processed" };
    }

    await acquireLock(db, churchId, messageId);

    const lockVerify = await db.collection("smsLocks").doc(churchId).get();
    if (lockVerify.data()?.messageId !== messageId) {
      throw new Error("Lock Mismatch: Race condition detected.");
    }

    const churchSnap = await db.collection("churches").doc(churchId).get();
    const churchData = churchSnap.data();
    const sender = churchData.sms?.senderId || "YEBFA";

    await db.runTransaction(async (t) => {
      await debitWalletTx(t, db, churchId, cost, messageId, data.type);
    });

    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const response = await axios.post(url, {
      recipient: [data.phone],
      sender: sender,
      message: data.message,
      is_schedule: false
    }, { timeout: 15000 });

    const isAccepted = response.status === 200 && (response.data?.code === "1000" || response.data?.status === "success");

    if (isAccepted) {
      const providerId = String(response.data?.summary?.[0]?.message_id || "mnotify_" + Date.now());
      const batch = db.batch();
      
      batch.update(db.collection("smsQueue").doc(messageId), { 
        status: "sent", 
        providerId,
        submittedAt: admin.firestore.FieldValue.serverTimestamp() 
      });

      batch.update(db.collection("smsLedger").doc(ledgerId), { 
        status: "SUBMITTED", 
        providerId 
      });

      batch.set(logRef, {
        churchId,
        phone: data.phone,
        message: data.message,
        type: data.type || "general",
        status: "sent",
        provider: "mnotify",
        providerId: providerId,
        cost: cost,
        queuedAt: data.createdAt || null,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        retryCount: data.retryCount || 0,
        memberName: data.memberName || "Guest",
        memberId: data.memberId || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
      return { success: true };
    } else {
      throw new Error(response.data?.message || "Provider Rejected Dispatch");
    }

  } catch (error) {
    console.error(`[Pipeline Error] ${messageId}:`, error.message);
    
    const ledgerSnap = await db.collection("smsLedger").doc(ledgerId).get();
    if (ledgerSnap.exists && ledgerSnap.data().status === "COMMITTED") {
      await refundWallet(churchId, cost, "dispatch_failed", messageId);
    }

    const retryable = isRetryableError(error.message);
    const retryCount = data.retryCount || 0;

    if (error.message.includes("Insufficient SMS credits")) {
      await db.collection("churches").doc(churchId).update({
        "sms.lowBalance": true,
        "sms.lastLowBalanceAt": admin.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
    }

    const batch = db.batch();
    
    batch.update(db.collection("smsQueue").doc(messageId), {
      status: retryable ? "queued_retry" : "failed_permanent",
      retryable,
      lastError: error.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      retryCount: admin.firestore.FieldValue.increment(retryable ? 1 : 0),
      nextRetryAt: retryable 
        ? admin.firestore.Timestamp.fromMillis(Date.now() + getBackoffDelay(retryCount))
        : null
    });

    // CRITICAL: Always write a log so the failure is visible in the dashboard
    batch.set(logRef, {
      churchId,
      phone: data.phone,
      message: data.message,
      type: data.type || "general",
      status: "failed",
      error: error.message,
      retryable,
      cost: cost,
      memberName: data.memberName || "Guest",
      memberId: data.memberId || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
    return { success: false, error: error.message };

  } finally {
    await releaseLock(db, churchId);
  }
}

async function refundWallet(churchId, amount, reason, messageId) {
  const db = admin.firestore();
  const walletRef = db.collection("smsWallets").doc(churchId);
  const churchRef = db.collection("churches").doc(churchId);
  const ledgerId = `${churchId}_${messageId}`;

  await db.runTransaction(async (t) => {
    const ledgerRef = db.collection("smsLedger").doc(ledgerId);
    const [ledgerSnap, walletSnap] = await Promise.all([
      t.get(ledgerRef),
      t.get(walletRef)
    ]);

    if (ledgerSnap.exists && ledgerSnap.data().status === "REFUNDED") return;

    t.update(ledgerRef, { status: "REFUND_PENDING" });

    const balance = walletSnap.exists ? Number(walletSnap.data().balance || 0) : 0;
    const newBalance = balance + amount;

    t.update(ledgerRef, { status: "REFUNDED", refundReason: reason });

    t.set(walletRef, {
      balance: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    t.update(churchRef, {
      "sms.credits": newBalance,
      "sms.stats.refunded": admin.firestore.FieldValue.increment(1),
      "sms.lowBalance": false
    });
  });
}

async function queueSMS(churchId, payload) {
  const db = admin.firestore();
  const churchDoc = await db.collection("churches").doc(churchId).get();
  
  if (!churchDoc.exists) {
    await logSmsEvent("SMS_BLOCKED_CHURCH_NOT_FOUND", churchId);
    return { success: false, error: "Church not found" };
  }
  
  const churchData = churchDoc.data();
  const smsConfig = churchData.sms || {};
  const isApproved = smsConfig.approved === true || smsConfig.status === "Approved";

  if (!isApproved) {
    await logSmsEvent("SMS_BLOCKED_NOT_APPROVED", churchId, { smsConfig });
    return { success: false, error: "SMS service not approved" };
  }
  
  if (!smsConfig.enabled || smsConfig.subscriptionStatus !== "active") {
    await logSmsEvent("SMS_BLOCKED_INACTIVE", churchId, { smsConfig });
    return { success: false, error: "SMS service disabled or subscription inactive" };
  }

  if ((payload.message || "").length > MAX_MESSAGE_LENGTH) return { success: false, error: "Message too long" };
  if (isPotentiallyMalicious(payload.message)) {
    await logSmsEvent("SMS_BLOCKED_SECURITY", churchId, { message: payload.message });
    return { success: false, error: "Security policy block" };
  }

  const formattedPhone = formatPhone(payload.phone);
  const dedupeKey = payload.dedupeKey || crypto.createHash("sha256")
    .update(`${churchId}:${formattedPhone}:${payload.message}`)
    .digest("hex");

  const cost = payload.cost || 1;

  const queueRef = await db.collection("smsQueue").add({
    churchId,
    phone: formattedPhone,
    message: payload.message,
    type: payload.type || "other",
    status: "queued",
    retryCount: 0,
    cost: cost,
    costLocked: true,
    dedupeKey,
    memberName: payload.memberName || "Guest",
    memberId: payload.memberId || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, messageId: queueRef.id };
}

async function creditWallet(churchId, amount, reason, processedBy) {
  const db = admin.firestore();
  const walletRef = db.collection("smsWallets").doc(churchId);
  const churchRef = db.collection("churches").doc(churchId);

  return await db.runTransaction(async (t) => {
    const walletSnap = await t.get(walletRef);
    const currentBalance = walletSnap.exists ? Number(walletSnap.data().balance || 0) : 0;
    const newBalance = currentBalance + Number(amount);

    t.set(walletRef, {
      balance: newBalance,
      totalTopups: admin.firestore.FieldValue.increment(Number(amount)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    t.update(churchRef, {
      "sms.credits": newBalance,
      "sms.lowBalance": newBalance > 10
    });

    return { success: true, newBalance };
  });
}

module.exports = {
  queueSMS,
  processSMSQueueItem,
  creditWallet,
  refundWallet
};
