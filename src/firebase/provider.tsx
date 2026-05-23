'use client';

import { ReactNode } from 'react';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { auth, firestore, functions } from './index';

/**
 * Firebase Provider enforces the central singletons.
 * Components should import { auth, functions, firestore } directly from '@/firebase'.
 */
export function FirebaseProvider({
  children,
}: {
  children: ReactNode;
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
