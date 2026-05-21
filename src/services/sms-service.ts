'use client';

import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  Firestore,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
 * Helper to normalize Ghana phone numbers to E.164 format (233XXXXXXXXX)
 */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "").trim();
  
  if (cleaned.startsWith("0")) {
    cleaned = "233" + cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Sends SMS via Firebase Cloud Function (Secure)
 * No API Keys are stored or used in the client code.
 */
async function sendSMSViaCloudFunction(phone: string, message: string, senderId: string) {
  const functions = getFunctions();
  const sendSMSFn = httpsCallable(functions, "sendSMS");

  try {
    const result: any = await sendSMSFn({ 
      phone: normalizePhone(phone), 
      message, 
      senderId 
    });

    return { 
      success: result.data.success, 
      data: result.data.data,
      error: result.data.error
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message 
    };
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
    const churchSnap = await getDoc(churchRef);
    const churchData = churchSnap.data();
    const sub = churchData?.subscription || { smsCredits: 0, smsUsed: 0 };

    if (sub.smsUsed >= sub.smsCredits) {
      throw new Error("SMS credits exhausted. Please recharge your account via Billing.");
    }

    // Hardcoded approved sender ID for testing as recommended
    const senderId = "YEBFA";

    const outcome = await sendSMSViaCloudFunction(normalizedPhone, payload.message, senderId);
    
    const logData: Omit<SMSLog, 'id'> = {
      churchId,
      memberId: payload.memberId || undefined,
      memberName: payload.memberName || "Unknown",
      phone: normalizedPhone,
      message: payload.message,
      status: outcome.success ? 'sent' : 'failed',
      type: payload.type,
      provider: 'mNotify',
      retryCount: payload.retryCount || 0,
      providerResponse: outcome.data || null,
      error: outcome.success ? undefined : (outcome.error || 'Delivery Failed'),
      cost: outcome.success ? 1 : 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(logsRef, logData);

    if (outcome.success) {
      await updateDoc(churchRef, {
        "subscription.smsUsed": increment(1)
      });
    }

    return { success: outcome.success, error: outcome.success ? undefined : outcome.error, id: docRef.id };
  } catch (error: any) {
    await addDoc(logsRef, {
      churchId,
      memberId: payload.memberId || undefined,
      memberName: payload.memberName || "Unknown",
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
        message: `Happy Birthday ${member.name}! May God bless your new age with favor, health, and prosperity. — ${member.churchName || 'Our Church'}.`,
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
