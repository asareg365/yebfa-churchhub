
"use client";

import { Bell, Search, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { MOCK_CHURCH } from "@/app/lib/mock-data";

export function Header() {
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
            <p className="text-sm font-semibold">{MOCK_CHURCH.name}</p>
            <p className="text-xs text-muted-foreground">{MOCK_CHURCH.plan} Plan</p>
          </div>
          <Avatar className="h-10 w-10 border-2 border-primary/20 p-0.5">
            <AvatarImage src={MOCK_CHURCH.logo} />
            <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
