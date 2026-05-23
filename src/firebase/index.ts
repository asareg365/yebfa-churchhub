'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { firebaseConfig } from './config';

// Validate config
const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

/**
 * SHARED FIREBASE SINGLETONS
 * Direct exports for consistent access across the app.
 */
export const firebaseApp = isConfigValid 
  ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig))
  : null as any;

export const firestore = firebaseApp ? getFirestore(firebaseApp) : null as any;
export const auth = firebaseApp ? getAuth(firebaseApp) : null as any;

/**
 * CRITICAL REGIONAL ALIGNMENT
 * Explicitly bound to us-central1 for all administrative handshakes.
 */
export const functions = firebaseApp ? getFunctions(firebaseApp, "us-central1") : null as any;

export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
