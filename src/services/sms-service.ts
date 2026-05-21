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
 * Enterprise SMS Log Interface
 */
export interface SMSLog {
  id?: string;
  churchId: string;
  memberId?: string;
  memberName?: string;
  phone: string;
  message: string;
  status: 'sent' | 'failed' | 'pending' | 'retrying';
  type: 'birthday' | 'announcement' | 'test' | 'reminder' | 'other';
  provider: string;
  retryCount: number;
  providerResponse?: any;
  error?: string;
  cost: number;
  createdAt: any;
  updatedAt?: any;
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
 */
async function sendSMSViaProvider(phone: string, message: string, senderId: string) {
  const apiKey = process.env.NEXT_PUBLIC_MNOTIFY_API_KEY || "4OAnq8qrPzc0T3dxgOrqFXKSt";
  const normalizedPhone = normalizePhone(phone);
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
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    return { success: response.status === 200, data: response.data };
  } catch (error: any) {
    return { success: false, error: error.message, data: error.response?.data };
  }
}

/**
 * SMS CREDIT ENGINE: 
 * 1. Checks limits before send.
 * 2. Increments usage after successful send.
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
    retryCount?: number;
  }
) {
  const logsRef = collection(db, 'churches', churchId, 'smsLogs');
  const churchRef = doc(db, 'churches', churchId);
  const normalizedPhone = normalizePhone(payload.phone);
  
  try {
    // 1. FETCH SUBSCRIPTION STATUS
    const churchSnap = await getDoc(churchRef);
    const churchData = churchSnap.data();
    const sub = churchData?.subscription || { smsCredits: 0, smsUsed: 0 };

    // 2. CREDIT CHECK
    if (sub.smsUsed >= sub.smsCredits) {
      throw new Error("SMS credits exhausted. Please recharge your account via Settings > Billing.");
    }

    const senderId = churchData?.settings?.senderId || "ChurchHub";

    // 3. ATTEMPT DELIVERY
    const outcome = await sendSMSViaProvider(normalizedPhone, payload.message, senderId);
    
    // 4. LOG TRANSACTION
    const logData: Omit<SMSLog, 'id'> = {
      churchId,
      memberId: payload.memberId,
      memberName: payload.memberName,
      phone: normalizedPhone,
      message: payload.message,
      status: outcome.success ? 'sent' : 'failed',
      type: payload.type,
      provider: 'mNotify',
      retryCount: payload.retryCount || 0,
      providerResponse: outcome.data,
      error: outcome.success ? undefined : outcome.error,
      cost: 1, // Standard 1 credit per message
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(logsRef, logData);

    // 5. UPDATE USAGE (POST-SEND)
    if (outcome.success) {
      await updateDoc(churchRef, {
        "subscription.smsUsed": increment(1)
      });
    }

    return { success: outcome.success, error: outcome.success ? undefined : outcome.error, id: docRef.id };
  } catch (error: any) {
    // LOG FAILURE
    await addDoc(logsRef, {
      churchId,
      memberId: payload.memberId,
      memberName: payload.memberName,
      phone: normalizedPhone,
      message: payload.message,
      status: 'failed',
      type: payload.type,
      provider: 'mNotify',
      retryCount: payload.retryCount || 0,
      error: error.message,
      cost: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { success: false, error: error.message };
  }
}

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

    const [year, month, day] = member.dateOfBirth.split('-').map(Number);
    if (month === currentMonth && day === currentDay) {
      const outcome = await sendAndLogSMS(db, churchId, {
        phone: member.phone,
        message: `Happy Birthday ${member.name}! God bless your new age. From ${member.churchName || 'Your Church'}.`,
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
