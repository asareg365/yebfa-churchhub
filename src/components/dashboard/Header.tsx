
"use client";

import { useMemo } from "react";
import { Bell, Search, User, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useUser, useCollection, useFirestore } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";

export function Header() {
  const { user } = useUser();
  const db = useFirestore();

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    const normalizedEmail = user.email.toLowerCase().trim();
    return query(
      collection(db, "churches"),
      where("adminEmails", "array-contains", normalizedEmail),
      limit(1)
    );
  }, [db, user?.email]);

  const { data: churches, loading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
  const isSuperAdmin = user?.email && SUPER_ADMINS.includes(user.email.toLowerCase().trim());

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-white/5 py-3 px-8 mb-6 rounded-2xl flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search members, events, records..." 
            className="pl-10 bg-white/5 border-white/10 rounded-xl focus-visible:ring-primary h-10"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative p-2 rounded-xl hover:bg-white/5 transition-colors text-muted-foreground">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-white/5">
          <div className="text-right hidden sm:block">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto" />
            ) : (
              <>
                <p className="text-sm font-semibold">
                  {isSuperAdmin ? "System Administrator" : (currentChurch?.name || "My Ministry")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isSuperAdmin ? "Global Access" : `${currentChurch?.plan || "Starter"} Plan`}
                </p>
              </>
            )}
          </div>
          <Avatar className="h-10 w-10 border-2 border-primary/20 p-0.5">
            <AvatarImage src={currentChurch?.logo} />
            <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
