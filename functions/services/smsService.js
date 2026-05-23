
const axios = require("axios");
const crypto = require("crypto");
const admin = require("firebase-admin");
const { formatPhone } = require("../utils/phoneFormatter");

const MAX_MESSAGE_LENGTH = 700;
const SPAM_KEYWORDS = ["bitcoin", "crypto", "investment", "prize", "won", "password", "otp", "lottery", "claim", "verify"];

/**
 * ABUSE DETECTION: Heuristic Content Analysis with Normalization
 */
function isPotentiallyMalicious(message) {
  const normalized = message.toLowerCase().replace(/[^a-z0-9 ]/g, "");
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
 * Distributed Locking with Versioning
 */
async function acquireLock(db, churchId, messageId) {
  const lockRef = db.collection("smsLocks").doc(churchId);
  const now = Date.now();

  await db.runTransaction(async (t) => {
    const snap = await t.get(lockRef);
    const existing = snap.exists ? snap.data() : null;

    if (existing?.locked && existing.expiresAt > now) {
      throw new Error("LOCKED: Organization is currently processing an SMS batch.");
    }

    t.set(lockRef, {
      locked: true,
      churchId,
      messageId,
      expiresAt: now + 60000, // 60s TTL
      version: now
    });
  });
}

async function releaseLock(db, churchId) {
  await db.collection("smsLocks").doc(churchId).delete();
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

  t.set(walletRef, {
    balance: newBalance,
    totalSpent: admin.firestore.FieldValue.increment(cost),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  t.update(churchRef, {
    "sms.credits": newBalance,
    "sms.lastSentAt": admin.firestore.FieldValue.serverTimestamp(),
    "sms.stats.sent": admin.firestore.FieldValue.increment(1),
    [`sms.stats.${type}`]: admin.firestore.FieldValue.increment(1)
  });

  t.set(ledgerRef, {
    churchId,
    messageId,
    type: "DEBIT",
    amount: cost,
    smsType: type,
    status: "COMMITTED",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Mission Critical SMS Pipeline (Enterprise Lifecycle)
 */
async function processSMSQueueItem(apiKey, messageId, data) {
  const db = admin.firestore();
  const churchId = data.churchId;
  const cost = data.cost || 1;
  const ledgerId = `${churchId}_${messageId}`;

  try {
    const earlyLedger = await db.collection("smsLedger").doc(ledgerId).get();
    if (earlyLedger.exists && ["SENT", "COMMITTED", "SUBMITTED"].includes(earlyLedger.data().status)) {
      return { skipped: true, reason: "already_processed" };
    }

    await acquireLock(db, churchId, messageId);

    const lockVerify = await db.collection("smsLocks").doc(churchId).get();
    if (lockVerify.data()?.messageId !== messageId) {
      throw new Error("Lock Mismatch");
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
      
      // Update Queue
      batch.update(db.collection("smsQueue").doc(messageId), { 
        status: "sent", 
        providerId,
        submittedAt: admin.firestore.FieldValue.serverTimestamp() 
      });

      // Update Ledger
      batch.update(db.collection("smsLedger").doc(ledgerId), { 
        status: "SUBMITTED", 
        providerId 
      });

      // Detailed SMS Log for Audit & UI
      const logRef = db.collection("churches").doc(churchId).collection("smsLogs").doc(messageId);
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
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
      return { success: true };
    } else {
      throw new Error(response.data?.message || "Provider Rejection");
    }

  } catch (error) {
    console.error(`[Pipeline Error] ${messageId}:`, error.message);
    
    const ledgerSnap = await db.collection("smsLedger").doc(ledgerId).get();
    if (ledgerSnap.exists && ledgerSnap.data().status === "COMMITTED") {
      await refundWallet(churchId, cost, "dispatch_failed", messageId);
    }

    await db.collection("smsQueue").doc(messageId).update({
      status: data.retryCount >= 5 ? "dead_letter" : "failed",
      lastError: error.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      retryCount: admin.firestore.FieldValue.increment(1)
    });

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
    const [ledgerSnap, walletSnap] = await Promise.all([
      t.get(db.collection("smsLedger").doc(ledgerId)),
      t.get(walletRef)
    ]);

    if (ledgerSnap.exists && ledgerSnap.data().status === "REFUNDED") return;

    const balance = walletSnap.exists ? Number(walletSnap.data().balance || 0) : 0;
    const newBalance = balance + amount;

    t.update(db.collection("smsLedger").doc(ledgerId), { status: "REFUNDED" });

    t.set(walletRef, {
      balance: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    t.update(churchRef, {
      "sms.credits": newBalance,
      "sms.stats.refunded": admin.firestore.FieldValue.increment(1)
    });
  });
}

async function queueSMS(churchId, payload) {
  const db = admin.firestore();
  const churchDoc = await db.collection("churches").doc(churchId).get();
  
  if (!churchDoc.exists) return { success: false, error: "Church not found" };
  
  const churchData = churchDoc.data();
  const smsConfig = churchData.sms || {};
  const isApproved = smsConfig.approved === true || smsConfig.status === "Approved";

  if (!isApproved || !smsConfig.enabled || smsConfig.subscriptionStatus !== "active") {
    await logSmsEvent("SMS_BLOCKED_STATUS", churchId, { smsConfig });
    return { success: false, error: "SMS service inactive or not approved" };
  }

  if (payload.message.length > MAX_MESSAGE_LENGTH) return { success: false, error: "Message too long" };
  if (isPotentiallyMalicious(payload.message)) return { success: false, error: "Security policy block" };

  const formattedPhone = formatPhone(payload.phone);
  const dedupeKey = payload.dedupeKey || crypto.createHash("sha256")
    .update(`${churchId}:${formattedPhone}:${payload.message}`)
    .digest("hex");

  await db.collection("smsQueue").add({
    churchId,
    phone: formattedPhone,
    message: payload.message,
    type: payload.type || "other",
    status: "queued",
    retryCount: 0,
    cost: payload.cost || 1,
    dedupeKey,
    memberName: payload.memberName || "Guest",
    memberId: payload.memberId || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
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
      "sms.credits": newBalance
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
