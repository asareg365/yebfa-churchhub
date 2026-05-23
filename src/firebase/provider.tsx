'use client';

import { ReactNode } from 'react';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { auth, firestore, functions } from './index';

/**
 * Firebase Context hooks now return the central singletons.
 * This maintains backwards compatibility while enforcing shared state.
 */
export function FirebaseProvider({
  children,
}: {
  children: ReactNode;
  firebaseApp?: any; 
  firestore?: any;
  auth?: any;
  functions?: any;
}) {
  return (
    <>
      <FirebaseErrorListener />
      {children}
    </>
  );
}

export function useFirestore() {
  return firestore;
}

export function useAuth() {
  return auth;
}

export function useFunctions() {
  return functions;
}
