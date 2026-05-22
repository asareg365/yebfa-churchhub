
const axios = require("axios");
const admin = require("firebase-admin");
const { formatPhone } = require("../utils/phoneFormatter");

/**
 * ABUSE PREVENTION CONFIG
 */
const MAX_MESSAGE_LENGTH = 700;
const SPAM_KEYWORDS = ["bitcoin", "crypto", "investment", "prize", "won", "password", "otp"];

function isPotentiallyMalicious(message) {
  const lowMsg = message.toLowerCase();
  return SPAM_KEYWORDS.some(keyword => lowMsg.includes(keyword));
}

/**
 * STEP 4 — Distributed Locking
 */
async function acquireLock(db, churchId, messageId) {
  const lockRef = db.collection("smsLocks").doc(churchId);
  const now = Date.now();

  await db.runTransaction(async (t) => {
    const snap = await t.get(lockRef);
    const existing = snap.exists ? snap.data() : null;

    if (existing?.locked && existing.expiresAt > now) {
      throw new Error("Organization is currently processing an SMS batch. Please wait.");
    }

    t.set(lockRef, {
      locked: true,
      messageId,
      expiresAt: now + 60000 // 60s lock TTL
    });
  });
}

async function releaseLock(db, churchId) {
  await db.collection("smsLocks").doc(churchId).delete();
}

/**
 * STEP 3 — Transactional Wallet Debit (Bulletproof Ledger Pattern)
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

  // IDEMPOTENCY GUARD
  if (ledgerSnap.exists) {
    const existing = ledgerSnap.data();
    if (existing.status === "COMMITTED" || existing.status === "SENT") return; 
    if (existing.status === "RESERVED") throw new Error("Transaction already in progress");
  }

  const wallet = walletSnap.exists ? walletSnap.data() : { balance: 0 };
  const balance = Number(wallet.balance || 0);

  if (balance < cost) throw new Error("Insufficient SMS credits");

  const newBalance = balance - cost;

  // 1. Update Wallet
  t.set(walletRef, {
    balance: newBalance,
    totalSpent: admin.firestore.FieldValue.increment(cost),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // 2. Sync Church Doc (UI Cache)
  t.update(churchRef, {
    "sms.credits": newBalance,
    "sms.lastSentAt": admin.firestore.FieldValue.serverTimestamp()
  });

  // 3. Commit to Ledger
  t.set(ledgerRef, {
    churchId,
    messageId,
    type: "DEBIT",
    amount: cost,
    status: "COMMITTED",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * STEP 5 — Mission Critical SMS Pipeline
 */
async function processSMSQueueItem(apiKey, messageId, data) {
  const db = admin.firestore();
  const churchId = data.churchId;
  const cost = data.cost || 1;
  const ledgerId = `${churchId}_${messageId}`;

  try {
    // Phase 1: Lock and Charge
    await acquireLock(db, churchId, messageId);

    await db.runTransaction(async (t) => {
      await debitWalletTx(t, db, churchId, cost, messageId, data.type);
    });

    // Phase 2: Dispatch to Provider (Outside Transaction)
    const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;
    const response = await axios.post(url, {
      recipient: [data.phone],
      sender: "YEBFA",
      message: data.message,
      is_schedule: false
    }, { timeout: 15000 });

    const isSent = response.status === 200 && (response.data?.code === "1000" || response.data?.status === "success");

    if (isSent) {
      const providerId = response.data?.summary?.[0]?.message_id || "mnotify_" + Date.now();
      
      const batch = db.batch();
      batch.update(db.collection("smsQueue").doc(messageId), { status: "sent", sentAt: admin.firestore.FieldValue.serverTimestamp() });
      batch.update(db.collection("smsLedger").doc(ledgerId), { status: "SENT", processedAt: admin.firestore.FieldValue.serverTimestamp(), providerId });
      await batch.commit();
      
      return { success: true };
    } else {
      throw new Error(response.data?.message || "Provider Rejection");
    }

  } catch (error) {
    console.error(`[Pipeline Error] ${messageId}:`, error.message);
    
    // Attempt Automatic Refund if committed
    const ledgerSnap = await db.collection("smsLedger").doc(ledgerId).get();
    if (ledgerSnap.exists && ledgerSnap.data().status === "COMMITTED") {
      await refundWallet(churchId, cost, "dispatch_failed", messageId);
    }

    await db.collection("smsQueue").doc(messageId).update({
      status: "failed",
      lastError: error.message,
      retryCount: admin.firestore.FieldValue.increment(1),
      nextRetryAt: null // Will be set by retry engine
    });

    return { success: false, error: error.message };

  } finally {
    await releaseLock(db, churchId);
  }
}

/**
 * WALLET REFUND (Atomic)
 */
async function refundWallet(churchId, amount, reason, messageId) {
  const db = admin.firestore();
  const walletRef = db.collection("smsWallets").doc(churchId);
  const churchRef = db.collection("churches").doc(churchId);
  const ledgerId = `${churchId}_${messageId}_refund`;

  await db.runTransaction(async (t) => {
    const walletSnap = await t.get(walletRef);
    const balance = walletSnap.exists ? walletSnap.data().balance : 0;
    const newBalance = balance + amount;

    t.set(walletRef, {
      balance: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    t.update(churchRef, {
      "sms.credits": newBalance
    });

    t.set(db.collection("smsLedger").doc(ledgerId), {
      churchId,
      messageId,
      type: "REFUND",
      amount,
      reason,
      status: "REFUNDED",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
}

/**
 * SMS QUEUE WRITER
 */
async function queueSMS(churchId, payload) {
  const db = admin.firestore();
  const churchDoc = await db.collection("churches").doc(churchId).get();
  if (!churchDoc.exists) return { success: false, error: "Org not found" };
  
  const churchData = churchDoc.data();
  if (!churchData.sms?.approved) return { success: false, error: "SMS service inactive" };

  if (payload.message.length > MAX_MESSAGE_LENGTH) return { success: false, error: "Message too long" };
  if (isPotentiallyMalicious(payload.message)) return { success: false, error: "Security policy block" };

  const dedupeKey = payload.dedupeKey || `${churchId}_${Date.now()}_${payload.phone}`;

  await db.collection("smsQueue").add({
    churchId,
    phone: formatPhone(payload.phone),
    message: payload.message,
    type: payload.type || "other",
    status: "queued",
    retryCount: 0,
    cost: payload.cost || 1,
    dedupeKey,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
}

/**
 * WALLET CREDIT (Admin Action)
 */
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
      "sms.lastTopupAt": admin.firestore.FieldValue.serverTimestamp()
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
