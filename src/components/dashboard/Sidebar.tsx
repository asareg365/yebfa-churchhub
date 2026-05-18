
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: Users, label: "Members", href: "/dashboard/members" },
  { icon: UserCheck, label: "Attendance", href: "/dashboard/attendance" },
  { icon: Calendar, label: "Events", href: "/dashboard/events" },
  { icon: CreditCard, label: "Finances", href: "/dashboard/finances" },
  { icon: MessageSquare, label: "Communications", href: "/dashboard/communication" },
  { icon: Sparkles, label: "AI Insights", href: "/dashboard/insights" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="fixed left-4 top-4 bottom-4 w-64 glass rounded-3xl z-50 flex flex-col p-6 border border-white/5 shadow-2xl overflow-hidden">
      <div className="mb-8 px-2">
        <h1 className="font-headline text-lg font-bold text-primary flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="text-primary">Y</span>
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">CHURCHHUB</span>
        </h1>
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
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
        })}
      </nav>

      <div className="pt-6 border-t border-white/5">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-300">
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
