
'use client';

import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  Firestore,
  query,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import axios from 'axios';

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
 * Helper to normalize Ghana phone numbers to E.164 format (+233)
 */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (cleaned.startsWith("0")) {
    return "+233" + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Sends SMS via mNotify API
 * Note: For client-side, we use public env vars.
 */
async function sendSMSViaProvider(phone: string, message: string, senderId: string) {
  const apiKey = process.env.NEXT_PUBLIC_MNOTIFY_API_KEY || "4OAnq8qrPzc0T3dxgOrqFXKSt";
  const normalizedPhone = normalizePhone(phone);
  
  // mNotify Quick SMS Endpoint
  const url = `https://api.mnotify.com/api/sms/quick?key=${apiKey}`;

  try {
    const response = await axios.post(
      url,
      {
        recipient: [normalizedPhone],
        sender: senderId,
        message: message,
        is_schedule: false
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    return { success: response.status === 200, data: response.data };
  } catch (error: any) {
    console.error("mNotify Client Error:", error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sends an SMS and logs the transaction in Firestore with tenant isolation.
 * Now includes credit check and incrementing.
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
  const normalizedPhone = normalizePhone(payload.phone);
  
  try {
    // Fetch church settings for senderId and subscription
    const churchSnap = await getDoc(churchRef);
    const churchData = churchSnap.data();
    
    // CREDIT CHECK
    const sub = churchData?.subscription || { smsCredits: 0, smsUsed: 0 };
    if (sub.smsUsed >= sub.smsCredits) {
      throw new Error("SMS credit exhausted. Please renew your plan.");
    }

    const senderId = churchData?.settings?.senderId || "ChurchHub";

    // 1. Attempt to send
    const outcome = await sendSMSViaProvider(normalizedPhone, payload.message, senderId);
    
    // 2. Log result
    const logData: SMSLog = {
      churchId,
      memberId: payload.memberId,
      memberName: payload.memberName,
      phone: normalizedPhone,
      message: payload.message,
      status: outcome.success ? 'sent' : 'failed',
      type: payload.type,
      error: outcome.success ? undefined : (outcome as any).error,
      createdAt: serverTimestamp(),
    };

    await addDoc(logsRef, logData);

    if (outcome.success) {
      // 3. Increment credits used
      await updateDoc(churchRef, {
        "subscription.smsUsed": increment(1)
      });
    }

    return { success: outcome.success, error: outcome.success ? undefined : (outcome as any).error };
  } catch (error: any) {
    // 4. Log failure
    await addDoc(logsRef, {
      churchId,
      memberId: payload.memberId,
      memberName: payload.memberName,
      phone: normalizedPhone,
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
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const membersSnap = await getDocs(membersRef);
  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const doc of membersSnap.docs) {
    const member = doc.data();
    if (!member.dateOfBirth || !member.phone) {
      results.skipped++;
      continue;
    }

    // Explicit parsing for YYYY-MM-DD
    const [year, month, day] = member.dateOfBirth.split('-').map(Number);
    
    if (month === currentMonth && day === currentDay) {
      const outcome = await sendAndLogSMS(db, churchId, {
        phone: member.phone,
        message: `Happy Birthday ${member.name}! God bless your new age.`,
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
