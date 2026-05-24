'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from './provider';
import { firebaseApp } from './index';
import { AlertCircle, Terminal, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hydration guard: ensures server and client HTML match
  if (!mounted) {
    return null;
  }

  // Check if singleton initialized correctly on the client
  if (!firebaseApp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Configuration Required</h1>
            <p className="text-muted-foreground">Please set up your Firebase environment variables to continue.</p>
          </div>

          <Alert variant="destructive" className="glass border-destructive/50">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Missing API Key</AlertTitle>
            <AlertDescription>
              The <code>NEXT_PUBLIC_FIREBASE_API_KEY</code> is missing or invalid. 
              The application cannot initialize Firebase services without a valid configuration.
            </AlertDescription>
          </Alert>

          <div className="glass p-6 rounded-2xl border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Terminal className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wider">Setup Instructions</span>
            </div>
            <div className="space-y-4 text-sm leading-relaxed">
              <p>1. Go to your <strong>Firebase Console</strong> and open your project settings.</p>
              <p>2. Copy your Web App configuration object.</p>
              <p>3. Create or update your <code>.env</code> file in the root directory with the following keys:</p>
              <pre className="bg-white/5 p-4 rounded-xl overflow-x-auto text-xs font-mono border border-white/5">
                NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key{"\n"}
                NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain{"\n"}
                NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id{"\n"}
                NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket{"\n"}
                NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id{"\n"}
                NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FirebaseProvider>
      {children}
    </FirebaseProvider>
  );
}
