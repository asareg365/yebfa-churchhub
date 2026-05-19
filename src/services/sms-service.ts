
'use client';

import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  Firestore,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';

/**
 * Interface for SMS Log entry
 */
export interface SMSLog {
  churchId: string;
  memberId?: string;
  memberName?: string;
  phone: string;
  message: string;
  status: 'sent' | 'failed' | 'pending';
  type: 'birthday' | 'announcement' | 'test' | 'other';
  error?: string;
  createdAt: any;
}

/**
 * Placeholder for mNotify SMS API simulation.
 * In production, the real sending happens in Cloud Functions or via a secure proxy.
 */
async function sendSMSViaProvider(phone: string, message: string, senderId: string) {
  console.log(`[mNotify SERVICE] Sending to ${phone} from ${senderId}: ${message}`);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, messageId: Math.random().toString(36).substr(2, 9) });
    }, 1000);
  });
}

/**
 * Sends an SMS and logs the transaction in Firestore with tenant isolation.
 */
export async function sendAndLogSMS(
  db: Firestore,
  churchId: string,
  payload: {
    phone: string;
    message: string;
    type: SMSLog['type'];
    memberId?: string;
    memberName?: string;
  }
) {
  const logsRef = collection(db, 'churches', churchId, 'smsLogs');
  const churchRef = doc(db, 'churches', churchId);
  
  try {
    // Fetch church settings for senderId
    const churchSnap = await getDoc(churchRef);
    const churchData = churchSnap.data();
    const senderId = churchData?.settings?.senderId || "ChurchHub";

    // 1. Attempt to send (Simulated on client, handled by mNotify on server)
    const response: any = await sendSMSViaProvider(payload.phone, payload.message, senderId);
    
    // 2. Log success
    const logData: SMSLog = {
      churchId,
      memberId: payload.memberId,
      memberName: payload.memberName,
      phone: payload.phone,
      message: payload.message,
      status: response.success ? 'sent' : 'failed',
      type: payload.type,
      createdAt: serverTimestamp(),
    };

    await addDoc(logsRef, logData);
    return { success: true };
  } catch (error: any) {
    // 3. Log failure
    await addDoc(logsRef, {
      churchId,
      memberId: payload.memberId,
      memberName: payload.memberName,
      phone: payload.phone,
      message: payload.message,
      status: 'failed',
      type: payload.type,
      error: error.message,
      createdAt: serverTimestamp(),
    });
    return { success: false, error: error.message };
  }
}

/**
 * Checks for members with birthdays today and sends them a greeting.
 */
export async function processBirthdaysToday(db: Firestore, churchId: string) {
  const membersRef = collection(db, 'churches', churchId, 'members');
  const churchRef = doc(db, 'churches', churchId);
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const [membersSnap, churchSnap] = await Promise.all([
    getDocs(membersRef),
    getDoc(churchRef)
  ]);

  const churchData = churchSnap.data();
  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const doc of membersSnap.docs) {
    const member = doc.data();
    if (!member.dateOfBirth || !member.phone) {
      results.skipped++;
      continue;
    }

    const dob = new Date(member.dateOfBirth);
    if (dob.getMonth() + 1 === currentMonth && dob.getDate() === currentDay) {
      const message = `Happy Birthday ${member.name}! God bless your new age. — ${churchData?.name || 'Our Church'}`;
      const outcome = await sendAndLogSMS(db, churchId, {
        phone: member.phone,
        message,
        type: 'birthday',
        memberId: doc.id,
        memberName: member.name
      });
      
      if (outcome.success) results.sent++;
      else results.failed++;
    }
  }

  return results;
}
