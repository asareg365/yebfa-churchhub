
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
  UserCheck,
  Loader2,
  History,
  AlertTriangle,
  Layout,
  ChevronRight,
  TrendingUp,
  Wallet,
  FileText,
  Package,
  Heart,
  HandHelping
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useUser, useCollection, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, limit } from "firebase/firestore";
import { useMemo, useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ALL_MENU_ITEMS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { id: "members", icon: Users, label: "Members", href: "/dashboard/members" },
  { id: "welfare", icon: HandHelping, label: "Welfare", href: "/dashboard/welfare" },
  { id: "visitors", icon: Heart, label: "Visitors", href: "/dashboard/visitors" },
  { id: "attendance", icon: UserCheck, label: "Attendance", href: "/dashboard/attendance" },
  { id: "events", icon: Calendar, label: "Events", href: "/dashboard/events" },
  { id: "finances", icon: CreditCard, label: "Finances", href: "/dashboard/finances" },
  { id: "sms", icon: MessageSquare, label: "SMS Center", href: "/dashboard/sms", isGroup: true, subItems: [
    { id: "sms-dash", label: "Dashboard", href: "/dashboard/sms", icon: MessageSquare },
    { id: "sms-logs", label: "SMS Logs", href: "/dashboard/sms/logs", icon: History },
    { id: "sms-failed", label: "Failed SMS", href: "/dashboard/sms/failed", icon: AlertTriangle },
    { id: "sms-templates", label: "Templates", href: "/dashboard/sms/templates", icon: Layout },
    { id: "sms-analytics", label: "Analytics", href: "/dashboard/sms/analytics", icon: TrendingUp },
  ]},
  { id: "billing-group", icon: Wallet, label: "Billing & Plans", href: "/dashboard/billing", isGroup: true, subItems: [
    { id: "bill-dash", label: "Overview", href: "/dashboard/billing", icon: Wallet },
    { id: "bill-plans", label: "Subscriptions", href: "/dashboard/billing/plans", icon: Package },
    { id: "bill-tx", label: "Transactions", href: "/dashboard/billing/transactions", icon: History },
    { id: "bill-reports", label: "Usage Reports", href: "/dashboard/billing/reports", icon: FileText },
  ]},
  { id: "analytics", icon: BarChart3, label: "Insights", href: "/dashboard/insights" },
  { id: "reports", icon: FileText, label: "Reports", href: "/dashboard/reports" },
  { id: "settings", icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

const CrossIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="w-6 h-6 text-primary"
  >
    <path d="M12 4v16M8 9h8" />
  </svg>
);

export function SidebarContent({ onNavItemClick }: { onNavItemClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();
  const [smsOpen, setSmsOpen] = useState(pathname.startsWith('/dashboard/sms'));
  const [billingOpen, setBillingOpen] = useState(pathname.startsWith('/dashboard/billing'));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSuperAdmin = useMemo(() => {
    const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
    return user?.email && SUPER_ADMINS.includes(user.email.toLowerCase().trim());
  }, [user?.email]);

  const selectedTenantSlug = typeof window !== 'undefined' ? localStorage.getItem('global_admin_selected_tenant') : null;

  const churchQuery = useMemo(() => {
    if (!user?.email || !db) return null;
    
    if (isSuperAdmin && selectedTenantSlug) {
      return query(
        collection(db, "churches"),
        where("slug", "==", selectedTenantSlug),
        limit(1)
      );
    }

    return query(
      collection(db, "churches"),
      where("adminEmails", "array-contains", user.email.toLowerCase().trim()),
      limit(1)
    );
  }, [db, user?.email, isSuperAdmin, selectedTenantSlug]);

  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const filteredMenuItems = useMemo(() => {
    if (!mounted) return ALL_MENU_ITEMS.filter(item => ["dashboard", "settings"].includes(item.id));
    
    if (isSuperAdmin) return ALL_MENU_ITEMS;
    if (churchLoading && !currentChurch) {
        return ALL_MENU_ITEMS.filter(item => ["dashboard", "settings"].includes(item.id));
    }

    const baseModules = ["dashboard", "settings", "billing-group", "visitors", "welfare"];
    const enabledModules = currentChurch?.enabledModules || [];
    
    const activeModules = [...enabledModules, ...baseModules];
    if (activeModules.includes('communication')) activeModules.push('sms');

    return ALL_MENU_ITEMS.filter(item => 
      activeModules.includes(item.id)
    );
  }, [currentChurch, churchLoading, isSuperAdmin, mounted]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-8 px-2">
        <Link href="/dashboard" className="font-headline text-lg font-bold text-primary flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-white border border-border shadow-sm flex items-center justify-center">
            <CrossIcon />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">CHURCHHUB</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
        {filteredMenuItems.map((item) => {
          if (item.isGroup) {
            const isGroupActive = pathname.startsWith(item.href);
            const isOpen = item.id === 'sms' ? smsOpen : billingOpen;
            const setOpen = item.id === 'sms' ? setSmsOpen : setBillingOpen;

            return (
              <Collapsible
                key={item.id}
                open={isOpen}
                onOpenChange={setOpen}
                className="space-y-1"
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-150",
                      isGroupActive && !isOpen
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                        : "text-muted-foreground hover:bg-muted hover:text-primary"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-5 h-5", isGroupActive && !isOpen ? "text-primary-foreground" : "text-primary/70")} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <ChevronRight className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-90")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-4 animate-in slide-in-from-top-1 duration-150">
                  {item.subItems?.map((sub) => {
                    const isSubActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.id}
                        href={sub.href}
                        onClick={onNavItemClick}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-150 text-sm",
                          isSubActive
                            ? "bg-primary/10 text-primary font-bold"
                            : "text-muted-foreground hover:bg-muted hover:text-primary"
                        )}
                      >
                        <sub.icon className="w-4 h-4" />
                        {sub.label}
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavItemClick}
              className={cn(
                "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                  : "text-muted-foreground hover:bg-muted hover:text-primary"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive ? "text-primary-foreground" : "text-primary/70")} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
        {churchLoading && !isSuperAdmin && (
          <div className="flex items-center gap-3 px-4 py-3 text-muted-foreground animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
            <span className="text-sm">Loading Modules...</span>
          </div>
        )}
      </nav>

      <div className="pt-6 border-t border-border mt-auto">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <div className="fixed left-4 top-4 bottom-4 w-72 bg-white rounded-3xl z-50 hidden lg:flex flex-col p-6 border border-border shadow-xl overflow-hidden transition-all duration-300">
      <SidebarContent />
    </div>
  );
}
