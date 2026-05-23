const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Migration Script: One-time execution to sync transactional wallets
 * usage: node migrate-wallets.js
 */
async function migrateWallets() {
  const db = admin.firestore();
  console.log("🚀 Starting Wallet Migration...");

  const churchesSnap = await db.collection("churches").get();

  for (const doc of churchesSnap.docs) {
    const church = doc.data();
    const churchId = doc.id;

    // Use current display credits as starting point for migration
    const existingCredits = Number(church.sms?.credits || 0);
    const walletRef = db.collection("smsWallets").doc(churchId);
    const walletSnap = await walletRef.get();

    if (!walletSnap.exists) {
      await walletRef.set({
        balance: existingCredits,
        totalSpent: Number(church.sms?.stats?.sent || 0),
        totalTopups: existingCredits,
        currency: "SMS_CREDIT",
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Wallet created for ${church.name || churchId}: ${existingCredits} credits`);
    } else {
      console.log(`⚠ Wallet already exists for ${church.name || churchId}`);
    }
  }

  console.log("🎉 Wallet migration complete");
}

migrateWallets()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
