
"use client";

import { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { Footer } from "@/components/dashboard/Footer";
import { useUser, useCollection, useFirestore } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";
import { Loader2, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(
      collection(db, "churches"),
      where("adminEmails", "array-contains", user.email.toLowerCase().trim()),
      limit(1)
    );
  }, [db, user?.email]);

  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (currentChurch?.mustChangePassword && pathname !== "/dashboard/settings") {
      router.push("/dashboard/settings?force=true");
    }
  }, [currentChurch, pathname, router]);

  if (loading || churchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isForcedPasswordChange = currentChurch?.mustChangePassword && pathname === "/dashboard/settings";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-72 p-4 flex flex-col">
        <Header />
        <div className="flex-1">
          {currentChurch?.mustChangePassword && pathname !== "/dashboard/settings" ? (
            <div className="flex items-center justify-center h-full p-8">
              <Card className="glass border-primary/30 max-w-md w-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <ShieldAlert className="h-6 w-6" />
                    Security Required
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    For your security, you must change your one-time password before accessing the dashboard.
                  </p>
                  <Link href="/dashboard/settings?force=true" className="block">
                    <Button className="w-full">Go to Settings</Button>
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
  );
}
