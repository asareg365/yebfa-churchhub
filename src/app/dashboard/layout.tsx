
'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { Footer } from '@/components/dashboard/Footer';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SearchProvider } from '@/context/search-context';

export default function DashboardLayout({
  children,
}: {
  children: React.Node;
}) {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(
      collection(db, 'churches'),
      where('adminEmails', 'array-contains', user.email.toLowerCase().trim()),
      limit(1)
    );
  }, [db, user?.email]);

  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  // Global Theme Enforcement
  useEffect(() => {
    if (!currentChurch?.settings?.theme) return;

    const applyTheme = (theme: string) => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');

      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    };

    applyTheme(currentChurch.settings.theme);

    // If system, listen for changes
    if (currentChurch.settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [currentChurch?.settings?.theme]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || churchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Initializing Ministry Hub...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isChangingPassword = pathname === '/dashboard/settings';
  const forcePasswordChange = currentChurch?.mustChangePassword && !isChangingPassword;

  return (
    <SearchProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-72 p-4 flex flex-col">
          <Header />
          <div className="flex-1">
            {forcePasswordChange ? (
              <div className="flex items-center justify-center h-full p-8">
                <Card className="glass border-primary/30 max-w-md w-full shadow-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <ShieldAlert className="h-6 w-6" />
                      Security Required
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      For your security, you must change your assigned password
                      before accessing the ministry dashboard.
                    </p>
                    <Link href="/dashboard/settings?force=true" className="block">
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        Go to Security Settings
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            ) : (
              children
            )}
          </div>
          <Footer />
        </main>
      </div>
    </SearchProvider>
  );
}
