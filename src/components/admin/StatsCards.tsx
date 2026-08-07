
import { Users, Coins, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformStats } from "@/types/admin";

interface StatsCardsProps {
  stats: PlatformStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-4">
      <Card className="glass border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
            <Users className="w-3 h-3"/> Total Tenants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.totalTenants.toLocaleString()}</div>
          <p className="text-[10px] text-muted-foreground mt-1">{stats.activeTenants} Active Organizations</p>
        </CardContent>
      </Card>
      
      <Card className="glass border-accent/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
            <Coins className="w-3 h-3"/> Platform Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-accent">GH₵{stats.totalRevenue.toLocaleString()}</div>
          <p className="text-[10px] text-muted-foreground mt-1">All-time credits allocated</p>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
            <TrendingUp className="w-3 h-3"/> Global Sent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{stats.totalSent.toLocaleString()}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Total platform dispatches</p>
        </CardContent>
      </Card>

      <Card className="glass border-destructive/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
            <AlertTriangle className="w-3 h-3"/> Global Failures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-destructive">{stats.totalFailed.toLocaleString()}</div>
          <p className="text-[10px] text-muted-foreground mt-1">System-wide errors</p>
        </CardContent>
      </Card>
    </div>
  );
}
