
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: any) => {
      const isPermissionError = error instanceof FirestorePermissionError || 
                               (error?.message && error.message.toLowerCase().includes('permission'));
      
      if (isPermissionError) {
        const description = error instanceof FirestorePermissionError 
          ? `You do not have permission to ${error.context.operation} at ${error.context.path}.`
          : error.message || 'Access denied by security rules.';

        toast({
          variant: 'destructive',
          title: 'Security Exception',
          description,
        });

        // In development, we want to see the error overlay
        if (process.env.NODE_ENV === 'development') {
           console.error('Firestore Security Rules Error:', error);
        }
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
