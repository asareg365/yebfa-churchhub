'use client';

import { useMemo } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart as PieIcon, 
  Users, 
  CheckCircle2, 
  AlertTriangle,
  MessageSquare,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, subDays, startOfMonth } from 'date-fns';

export default function SMSAnalyticsPage() {
  const db = useFirestore();
  const { user } = useUser();

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const logsRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, 'churches', currentChurch.id, 'smsLogs');
  }, [db, currentChurch?.id]);

  const { data: allLogs } = useCollection(logsRef ? query(logsRef, orderBy('createdAt', 'desc'), limit(1000)) : null);

  const stats = useMemo(() => {
    if (!allLogs) return { total: 0, sent: 0, failed: 0, successRate: 0 };
    const total = allLogs.length;
    const sent = allLogs.filter(l => l.status === 'sent').length;
    const failed = allLogs.filter(l => l.status === 'failed').length;
    return {
      total,
      sent,
      failed,
      successRate: total > 0 ? Math.round((sent / total) * 100) : 0
    };
  }, [allLogs]);

  const typeData = useMemo(() => {
    if (!allLogs) return [];
    const types = ['birthday', 'announcement', 'test', 'reminder'];
    return types.map(type => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: allLogs.filter(l => l.type === type).length
    })).filter(t => t.value > 0);
  }, [allLogs]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#8884d8', '#ffc658'];

  const trendData = useMemo(() => {
    if (!allLogs) return [];
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = subDays(new Date(), i);
      return format(d, 'MMM dd');
    }).reverse();

    return last14Days.map(day => {
      const dayLogs = allLogs.filter(l => l.createdAt?.toDate && format(l.createdAt.toDate(), 'MMM dd') === day);
      return {
        name: day,
        volume: dayLogs.length
      };
    });
  }, [allLogs]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Communication Analytics</h2>
        <p className="text-muted-foreground">Detailed insights into your church's outreach impact.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{stats.successRate}%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Reliable delivery track record</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-[10px] text-muted-foreground mt-1">All-time communications</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Failed Delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{stats.failed}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>
        <Card className="glass border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">SMS Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{currentChurch?.subscription?.smsCredits || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Monthly allocation</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass md:col-span-2 h-[450px]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Communication Activity (14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass h-[450px]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-accent" />
              Message Types
            </CardTitle>
            <CardDescription className="text-xs">Breakdown of communication categories.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground italic text-sm">No categorical data.</div>
            )}
          </CardContent>
          {typeData.length > 0 && (
            <div className="px-6 pb-6 grid grid-cols-2 gap-2">
              {typeData.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{t.name}: {t.value}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
