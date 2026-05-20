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
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useUser, useCollection, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, limit } from "firebase/firestore";
import { useMemo } from "react";

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

const CrossIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="w-5 h-5 text-primary"
  >
    <path d="M12 3v18M8 8h8" />
  </svg>
);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();

  const isSuperAdmin = useMemo(() => {
    const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
    return user?.email && SUPER_ADMINS.includes(user.email.toLowerCase().trim());
  }, [user?.email]);

  const churchQuery = useMemo(() => {
    if (!user?.email || isSuperAdmin) return null;
    return query(
      collection(db, "churches"),
      where("adminEmails", "array-contains", user.email.toLowerCase().trim()),
      limit(1)
    );
  }, [db, user?.email, isSuperAdmin]);

  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const filteredMenuItems = useMemo(() => {
    if (isSuperAdmin) return ALL_MENU_ITEMS;
    if (churchLoading) return [];

    const baseModules = ["dashboard", "settings"];
    const enabledModules = currentChurch?.enabledModules || [];
    
    return ALL_MENU_ITEMS.filter(item => 
      baseModules.includes(item.id) || enabledModules.includes(item.id)
    );
  }, [currentChurch, churchLoading, isSuperAdmin]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="fixed left-4 top-4 bottom-4 w-72 bg-white rounded-3xl z-50 flex flex-col p-6 border border-border shadow-xl overflow-hidden">
      <div className="mb-8 px-2">
        <h1 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/30">
            <CrossIcon />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">CHURCHHUB</span>
        </h1>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
        {(churchLoading && !isSuperAdmin) ? (
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
                    : "text-muted-foreground hover:bg-muted hover:text-primary"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive ? "text-primary-foreground" : "text-primary/70")} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })
        )}
      </nav>

      <div className="pt-6 border-t border-border">
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
