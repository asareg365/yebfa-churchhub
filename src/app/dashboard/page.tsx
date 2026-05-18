"use client";

import { 
  Users, 
  Calendar, 
  TrendingUp, 
  CreditCard, 
  Cake, 
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  DollarSign
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MOCK_CHURCH, MOCK_ATTENDANCE } from "@/app/lib/mock-data";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { cn } from "@/lib/utils";

const stats = [
  { label: "Total Members", value: MOCK_CHURCH.stats.totalMembers, icon: Users, trend: "+12%", trendUp: true },
  { label: "Upcoming Birthdays", value: MOCK_CHURCH.stats.upcomingBirthdays, icon: Cake, trend: "Today", trendUp: true },
  { label: "Events This Month", value: MOCK_CHURCH.stats.activeEvents, icon: Calendar, trend: "-2", trendUp: false },
  { label: "Attendance Rate", value: `${MOCK_CHURCH.stats.attendanceRate}%`, icon: TrendingUp, trend: "+5%", trendUp: true },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Welcome back, Admin</h2>
          <p className="text-muted-foreground">Here's what's happening at {MOCK_CHURCH.name} today.</p>
        </div>
        <div className="glass px-4 py-2 rounded-xl border-primary/20 text-xs font-semibold text-primary uppercase tracking-wider">
          System Live
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass group hover:border-primary/50 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <stat.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={cn(
                "text-xs mt-1 flex items-center gap-1",
                stat.trendUp ? "text-accent" : "text-destructive"
              )}>
                {stat.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.trend} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="trends" className="rounded-xl px-6">
            <Activity className="w-4 h-4 mr-2" />
            Attendance Trends
          </TabsTrigger>
          <TabsTrigger value="financials" className="rounded-xl px-6">
            <DollarSign className="w-4 h-4 mr-2" />
            Financial Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="animate-in fade-in-50 duration-500">
          <Card className="glass h-[400px]">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Attendance Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MOCK_ATTENDANCE}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials" className="animate-in fade-in-50 duration-500">
          <Card className="glass h-[400px]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-accent" />
                Financial Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-6 rounded-3xl bg-white/5 border border-white/5">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Total Tithes</p>
                      <p className="text-3xl font-bold text-accent">GH₵45,200.00</p>
                    </div>
                    <div className="h-14 w-14 rounded-full border-4 border-accent/20 border-t-accent animate-spin-slow"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="text-sm">Operations</span>
                      </div>
                      <span className="text-sm font-semibold">40%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div className="bg-primary h-full w-[40%]"></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-accent"></div>
                        <span className="text-sm">Outreach</span>
                      </div>
                      <span className="text-sm font-semibold">35%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div className="bg-accent h-full w-[35%]"></div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col justify-center space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your ministry's financial health is currently <span className="text-accent font-bold">stable</span>. 
                    Tithes have increased by 5.4% compared to the historical average.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                      <p className="text-xs text-muted-foreground">Monthly Growth</p>
                      <p className="text-xl font-bold">+12%</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                      <p className="text-xs text-muted-foreground">Retention</p>
                      <p className="text-xl font-bold">88%</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}