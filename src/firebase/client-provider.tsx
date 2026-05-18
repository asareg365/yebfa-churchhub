
'use client';

import { ReactNode, useState } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Initialize Firebase only on the client
  const [{ firebaseApp, firestore, auth }] = useState(() => initializeFirebase());

  return (
    <FirebaseProvider firebaseApp={firebaseApp} firestore={firestore} auth={auth}>
      {children}
    </FirebaseProvider>
  );
}
