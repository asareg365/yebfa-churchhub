'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { firebaseConfig } from './config';

/**
 * SHARED FIREBASE SINGLETONS
 * This is the central source of truth for all Firebase services.
 * Regional binding for Functions is enforced here (us-central1).
 */

const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

export const firebaseApp = isConfigValid 
  ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig))
  : null as any;

export const firestore = firebaseApp ? getFirestore(firebaseApp) : null as any;
export const auth = firebaseApp ? getAuth(firebaseApp) : null as any;

/**
 * PRODUCTION REGION: us-central1
 * All administrative callable handshakes are routed here.
 */
export const functions = firebaseApp ? getFunctions(firebaseApp, "us-central1") : null as any;

// Export supporting hooks and providers
export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
