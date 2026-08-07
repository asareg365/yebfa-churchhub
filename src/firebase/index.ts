'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getFunctions, Functions } from 'firebase/functions';
import { firebaseConfig } from './config';

/**
 * SHARED FIREBASE SINGLETONS
 * Central source of truth for all Firebase services.
 */

const isConfigValid = typeof window !== 'undefined' && !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

let initializedApp: FirebaseApp | null = null;

if (isConfigValid) {
  try {
    initializedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  } catch (err) {
    console.error("Firebase Initialization Error:", err);
  }
}

export const firebaseApp = initializedApp;

/**
 * Singleton Instances with descriptive initialization
 */
export const auth: Auth = firebaseApp ? getAuth(firebaseApp) : (null as any);
export const firestore: Firestore = firebaseApp ? getFirestore(firebaseApp) : (null as any);
export const functions: Functions = firebaseApp ? getFunctions(firebaseApp, "us-central1") : (null as any);

// Export supporting hooks and providers
export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
