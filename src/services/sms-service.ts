
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
  increment,
  query,
  where
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
 * Optimized send and log flow.
 * Note: Credits and Status validation now happen securely in Cloud Functions.
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
  const functions = getFunctions();
  const sendSMSFn = httpsCallable(functions, "sendSMS");

  try {
    const result: any = await sendSMSFn({ 
      phone: normalizePhone(payload.phone), 
      message: payload.message, 
      type: payload.type,
      memberName: payload.memberName,
      memberId: payload.memberId,
      churchId: churchId
    });

    if (!result.data.success) {
      return { success: false, error: result.data.error || 'Backend delivery failure' };
    }

    return { success: true };
  } catch (error: any) {
    console.error("SMS Bridge Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Optimized Birthday Processor using indexed birthdayKey query
 */
export async function processBirthdaysToday(db: Firestore, churchId: string) {
  const membersRef = collection(db, 'churches', churchId, 'members');
  const today = new Date();
  
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();
  const todayKey = `${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

  const q = query(membersRef, where("birthdayKey", "==", todayKey));
  const membersSnap = await getDocs(q);
  
  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const memberDoc of membersSnap.docs) {
    const member = memberDoc.data();
    if (!member.phone) {
      results.skipped++;
      continue;
    }

    const outcome = await sendAndLogSMS(db, churchId, {
      phone: member.phone,
      message: `Happy Birthday ${member.name}! May God bless your new age. — From your Church Family.`,
      type: 'birthday',
      memberId: memberDoc.id,
      memberName: member.name
    });

    if (outcome.success) results.sent++;
    else results.failed++;
  }
  
  return results;
}
