"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  CreditCard, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  LogOut,
  Sparkles,
  UserCheck,
  ShieldAlert,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useUser, useCollection, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, limit } from "firebase/firestore";
import { useMemo } from "react";

const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];

const ALL_MENU_ITEMS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { id: "members", icon: Users, label: "Members", href: "/dashboard/members" },
  { id: "attendance", icon: UserCheck, label: "Attendance", href: "/dashboard/attendance" },
  { id: "events", icon: Calendar, label: "Events", href: "/dashboard/events" },
  { id: "finances", icon: CreditCard, label: "Finances", href: "/dashboard/finances" },
  { id: "communication", icon: MessageSquare, label: "Communications", href: "/dashboard/communication" },
  { id: "insights", icon: Sparkles, label: "AI Insights", href: "/dashboard/insights" },
  { id: "reports", icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { id: "settings", icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();

  const isSuperAdmin = user?.email && SUPER_ADMINS.includes(user.email);

  // Fetch current user's church to check enabled modules
  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(
      collection(db, "churches"),
      where("adminEmails", "array-contains", user.email),
      limit(1)
    );
  }, [db, user?.email]);

  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const filteredMenuItems = useMemo(() => {
    if (churchLoading) return [];
    
    // Always show Overview, Settings and Dashboard base
    const baseModules = ["dashboard", "settings"];
    const enabledModules = currentChurch?.enabledModules || [];
    
    return ALL_MENU_ITEMS.filter(item => 
      baseModules.includes(item.id) || enabledModules.includes(item.id)
    );
  }, [currentChurch, churchLoading]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="fixed left-4 top-4 bottom-4 w-72 glass rounded-3xl z-50 flex flex-col p-6 border border-white/5 shadow-2xl overflow-hidden">
      <div className="mb-8 px-2">
        <h1 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="text-primary">Y</span>
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">CHURCHHUB</span>
        </h1>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
        {churchLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
        ) : (
          filteredMenuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive ? "text-primary-foreground" : "text-primary/70")} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })
        )}
        
        {/* System Admin Link - Only visible to super admins */}
        {isSuperAdmin && (
          <Link
            href="/admin"
            className={cn(
              "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 mt-4 border border-dashed border-primary/20 hover:border-primary/50",
              pathname === "/admin" ? "bg-white/10 text-primary" : "text-muted-foreground"
            )}
          >
            <ShieldAlert className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold">Admin Portal</span>
          </Link>
        )}
      </nav>

      <div className="pt-6 border-t border-white/5">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-300"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}