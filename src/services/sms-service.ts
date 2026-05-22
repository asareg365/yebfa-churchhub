
'use client';

import { 
  collection, 
  getDocs,
  query,
  where,
  Firestore,
  doc,
  getDoc
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
  
  // Standardize common Ghana formats
  if (cleaned.startsWith("0")) {
    cleaned = "233" + cleaned.substring(1);
  } else if (cleaned.length === 9) {
    cleaned = "233" + cleaned;
  }

  return cleaned;
}

/**
 * Optimized send and log flow via secure Cloud Function bridge.
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
    const response: any = await sendSMSFn({ 
      phone: normalizePhone(payload.phone), 
      message: payload.message, 
      type: payload.type,
      memberName: payload.memberName,
      memberId: payload.memberId,
      churchId: churchId
    });

    if (!response.data.success) {
      return { success: false, error: response.data.error || 'Backend delivery failure' };
    }

    return { success: true };
  } catch (error: any) {
    console.error("SMS Bridge Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Optimized Birthday Processor using indexed birthdayKey query.
 * Matches exactly celebrants for the current UTC day.
 */
export async function processBirthdaysToday(db: Firestore, churchId: string) {
  // 1. Fetch Church Info for branding
  const churchRef = doc(db, 'churches', churchId);
  const churchSnap = await getDoc(churchRef);
  const churchData = churchSnap.data();
  
  const churchDisplayName = churchData?.sms?.displayName || churchData?.name || "Our Church";
  const template = churchData?.smsTemplates?.birthday || "Happy Birthday {{name}}! May God bless your new age richly. — {{churchName}}";

  const membersRef = collection(db, 'churches', churchId, 'members');
  
  // Strict UTC-based Today Key (MM-DD)
  const today = new Date();
  const month = String(today.getUTCMonth() + 1).padStart(2, '0');
  const day = String(today.getUTCDate()).padStart(2, '0');
  const todayKey = `${month}-${day}`;

  console.log(`[SMS Bridge] Searching for birthdayKey: ${todayKey}`);

  const q = query(membersRef, where("birthdayKey", "==", todayKey));
  const membersSnap = await getDocs(q);
  
  const results = { sent: 0, failed: 0, skipped: 0 };

  if (membersSnap.empty) {
    console.log("[SMS Bridge] No celebrants found for today.");
    return results;
  }

  console.log(`[SMS Bridge] Found ${membersSnap.size} member(s) celebrating today.`);

  for (const memberDoc of membersSnap.docs) {
    const member = memberDoc.data();
    
    if (!member.phone) {
      results.skipped++;
      continue;
    }

    // 2. Personalize Message using church settings
    const personalizedMessage = template
      .replace(/{{name}}/g, member.name)
      .replace(/{{churchName}}/g, churchDisplayName);

    // Individual send request
    const outcome = await sendAndLogSMS(db, churchId, {
      phone: member.phone,
      message: personalizedMessage,
      type: 'birthday',
      memberId: memberDoc.id,
      memberName: member.name
    });

    if (outcome.success) {
      results.sent++;
    } else {
      results.failed++;
    }
  }
  
  return results;
}
