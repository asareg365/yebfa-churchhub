'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getFunctions, Functions } from 'firebase/functions';
import { firebaseConfig } from './config';

export function initializeFirebase(): {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  functions: Functions;
} | null {
  // Validate config
  const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

  if (!isConfigValid) {
    return null;
  }

  try {
    const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const firestore = getFirestore(firebaseApp);
    const auth = getAuth(firebaseApp);
    
    // CRITICAL: Explicitly set region to match backend deployment
    const functions = getFunctions(firebaseApp, "us-central1");

    return { firebaseApp, firestore, auth, functions };
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    return null;
  }
}

export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
