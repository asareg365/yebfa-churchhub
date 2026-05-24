'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getFunctions, Functions } from 'firebase/functions';
import { firebaseConfig } from './config';

/**
 * SHARED FIREBASE SINGLETONS
 * Central source of truth for all Firebase services.
 * Regional binding for Functions is strictly us-central1.
 */

const isConfigValid = typeof window !== 'undefined' && !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

const app = isConfigValid 
  ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firebaseApp = app;

/**
 * Singleton Instances
 */
export const firestore: Firestore = app ? getFirestore(app) : (null as any);
export const auth: Auth = app ? getAuth(app) : (null as any);
export const functions: Functions = app ? getFunctions(app, "us-central1") : (null as any);

// Export supporting hooks and providers
export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
