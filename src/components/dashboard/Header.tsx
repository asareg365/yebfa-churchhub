
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, User, Loader2, CheckCircle2, AlertCircle, Trash2, Menu } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useUser, useCollection, useFirestore } from "@/firebase";
import { collection, query, where, limit, orderBy, writeBatch, doc } from "firebase/firestore";
import { useSearch } from "@/context/search-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SidebarContent } from "./Sidebar";

export function Header() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { searchTerm, setSearchTerm } = useSearch();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const churchQuery = useMemo(() => {
    if (!user?.email || !db) return null;
    const normalizedEmail = user.email.toLowerCase().trim();
    return query(
      collection(db, "churches"),
      where("adminEmails", "array-contains", normalizedEmail),
      limit(1)
    );
  }, [db, user?.email]);

  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const notificationsQuery = useMemo(() => {
    if (!currentChurch?.id || !db) return null;
    return query(
      collection(db, "churches", currentChurch.id, "smsLogs"),
      orderBy("createdAt", "desc"),
      limit(5)
    );
  }, [db, currentChurch?.id]);

  const { data: notifications, loading: notificationsLoading } = useCollection(notificationsQuery);

  const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
  const isSuperAdmin = user?.email && SUPER_ADMINS.includes(user.email.toLowerCase().trim());

  const handleClearNotifications = async () => {
    if (!currentChurch?.id || !notifications || notifications.length === 0) return;
    
    const batch = writeBatch(db);
    notifications.forEach((notif: any) => {
      batch.delete(doc(db, "churches", currentChurch.id, "smsLogs", notif.id));
    });

    try {
      await batch.commit();
      toast({ title: "Notifications cleared" });
    } catch (error) {
      toast({ title: "Clear failed", variant: "destructive" });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-border py-3 px-4 lg:px-8 mb-6 lg:rounded-2xl flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden rounded-xl">
              <Menu className="w-6 h-6 text-primary" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-6 glass">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
            </SheetHeader>
            <SidebarContent onNavItemClick={() => setIsMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search dashboard content..." 
            className="pl-10 bg-muted/20 border-border rounded-xl focus-visible:ring-primary h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 lg:gap-6">
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground group">
              <Bell className="w-5 h-5 group-hover:text-primary transition-colors" />
              {notifications && notifications.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 shadow-2xl border-border" align="end">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">Recent Notifications</h4>
                <p className="text-[10px] text-muted-foreground">Latest communication activity</p>
              </div>
              {notifications && notifications.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 text-[10px] font-bold text-destructive hover:bg-destructive/10"
                  onClick={handleClearNotifications}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notificationsLoading ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : notifications && notifications.length > 0 ? (
                notifications.map((notif: any) => (
                  <div key={notif.id} className="p-4 border-b border-border last:border-0 hover:bg-muted transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={notif.status === 'sent' ? 'text-accent' : 'text-destructive'}>
                        {notif.status === 'sent' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{notif.memberName || notif.phone}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{notif.message}</p>
                        <div className="flex justify-between items-center mt-1">
                          <Badge variant="outline" className="text-[8px] py-0 px-1 uppercase">{notif.type}</Badge>
                          <span className="text-[9px] text-muted-foreground">
                            {notif.createdAt?.toDate ? format(notif.createdAt.toDate(), 'HH:mm') : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground text-xs italic">
                  No recent activity found.
                </div>
              )}
            </div>
            <div className="p-2 border-t border-border text-center">
              <button 
                onClick={() => router.push("/dashboard/sms/logs")}
                className="text-[10px] text-primary hover:underline font-bold w-full py-1"
              >
                View Communication Logs
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right hidden lg:block">
            {churchLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto" />
            ) : (
              <>
                <p className="text-sm font-semibold truncate max-w-[150px]">
                  {isSuperAdmin ? "System Administrator" : (currentChurch?.name || "My Ministry")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isSuperAdmin ? "Global Access" : `${currentChurch?.plan || "Starter"} Plan`}
                </p>
              </>
            )}
          </div>
          <Avatar className="h-9 w-9 lg:h-10 lg:w-10 border-2 border-primary/20 p-0.5">
            <AvatarImage src={currentChurch?.logo} />
            <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
