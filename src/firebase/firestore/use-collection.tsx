'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

/**
 * Hook to subscribe to a Firestore collection.
 * Handled injection of document IDs and type casting.
 */
export function useCollection<T = DocumentData>(query: Query<any> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      setData([]);
      return;
    }

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const items = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        } as unknown as T));
        setData(items);
        setError(null);
        setLoading(false);
      },
      async (serverError: any) => {
        // Only emit FirestorePermissionError if the code is actually permission-denied
        if (serverError.code === 'permission-denied') {
          const path = (query as any).path || (query as any)._query?.path?.toString?.() || 'unknown';
          
          const permissionError = new FirestorePermissionError({
            path,
            operation: 'list',
          });
          
          errorEmitter.emit('permission-error', permissionError);
        }
        
        setError(serverError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
}
