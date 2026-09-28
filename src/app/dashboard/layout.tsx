'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { TenantProvider } from "@/context/tenant-context";

const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];

const CrossIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 4v16M8 9h8" />
  </svg>
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    const saved = localStorage.getItem("global_admin_selected_tenant");

    if (saved) {
      setSelectedTenantSlug(saved.toLowerCase().trim());
    }
  }, []);

  const isSuperAdmin = useMemo(() => {
    return user?.email && SUPER_ADMINS.includes(user.email.toLowerCase().trim());
  }, [user?.email]);

  const churchQuery = useMemo(() => {
    if (!user?.email || !db) return null;
    const normalizedEmail = user.email.toLowerCase().trim();

    // If super admin has selected a specific tenant, view that one
    if (isSuperAdmin && selectedTenantSlug) {
      return query(
        collection(db, 'churches'),
        where('slug', '==', selectedTenantSlug),
        limit(1)
      );
    }

    // Default: find churches where user is an admin
    return query(
      collection(db, 'churches'),
      where('adminEmails', 'array-contains', normalizedEmail),
      limit(1)
    );
  }, [db, user?.email, isSuperAdmin, selectedTenantSlug]);

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

    if (currentChurch.settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [currentChurch?.settings?.theme]);

  useEffect(() => {
    if (mounted && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, mounted]);

  if (!mounted || loading || churchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-1000">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-2xl flex items-center justify-center border border-border">
             <CrossIcon className="w-12 h-12 text-primary" />
          </div>
          <div className="text-center space-y-3">
            <h2 className="font-headline text-xl font-bold tracking-tighter text-foreground">CHURCHHUB</h2>
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground animate-pulse">
                Initializing Ministry Hub
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isChangingPassword = pathname === '/dashboard/settings';
  const forcePasswordChange = currentChurch?.mustChangePassword && !isChangingPassword;

  return (
    <TenantProvider>
      <SearchProvider>
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <main className="flex-1 lg:ml-80 p-4 flex flex-col min-w-0">
            <Header />
            <div className="flex-1">
              {!currentChurch && isSuperAdmin ? (
                 <div className="flex items-center justify-center h-full p-8 text-center">
                   <Card className="glass max-w-md p-8 space-y-4">
                     <ShieldAlert className="w-12 h-12 text-primary mx-auto" />
                     <h3 className="text-xl font-bold">Global Admin Access</h3>
                     <p className="text-sm text-muted-foreground">Select a ministry from the Switcher in the top header to begin management.</p>
                   </Card>
                 </div>
              ) : forcePasswordChange ? (
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
    </TenantProvider>
  );
}