
'use client';

import { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart as PieIcon, 
  CheckCircle2, 
  MessageSquare,
  Zap,
  Target,
  Clock,
  Loader2,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar } from 'recharts';
import { format, subDays, startOfMonth } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function SMSAnalyticsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const logsRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, 'churches', currentChurch.id, 'smsLogs');
  }, [db, currentChurch?.id]);

  const { data: allLogs, loading: logsLoading } = useCollection(logsRef ? query(logsRef, orderBy('createdAt', 'desc'), limit(1000)) : null);

  const stats = useMemo(() => {
    if (!allLogs || allLogs.length === 0) return { total: 0, sent: 0, failed: 0, delivered: 0, successRate: 0, deliveryRate: 0, monthlyUsage: 0 };
    const total = allLogs.length;
    const sent = allLogs.filter(l => l.status === 'sent').length;
    const failed = allLogs.filter(l => l.status === 'failed').length;
    const delivered = allLogs.filter(l => l.providerStatus === 'delivered').length;
    
    const currentMonth = startOfMonth(new Date());
    const monthlyUsage = allLogs.filter(l => l.createdAt?.toDate && l.createdAt.toDate() >= currentMonth && l.status === 'sent').length;

    return {
      total,
      sent,
      failed,
      delivered,
      monthlyUsage,
      successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0
    };
  }, [allLogs]);

  const campaignBreakdown = useMemo(() => {
    if (!allLogs) return [];
    const types = ['birthday', 'announcement', 'reminder', 'followup'];
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
        volume: dayLogs.length,
        success: dayLogs.filter(l => l.status === 'sent').length
      };
    });
  }, [allLogs]);

  if (!mounted || churchLoading || logsLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Aggregating outreach intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Communication Intelligence</h2>
          <p className="text-muted-foreground">Comprehensive performance metrics for {currentChurch?.name}.</p>
        </div>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 h-8 px-4 rounded-xl font-bold">
          <Zap className="w-3 h-3 mr-2" /> Real-time Audit
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Target className="w-3 h-3 text-accent" /> Delivery Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{stats.deliveryRate}%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Verified on handsets</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Calendar className="w-3 h-3" /> Monthly Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.monthlyUsage.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Credits used this month</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><MessageSquare className="w-3 h-3" /> Total Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.sent.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Successful platform dispatches</p>
          </CardContent>
        </Card>
        <Card className="glass border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Clock className="w-3 h-3 text-primary" /> Remaining Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{(currentChurch?.sms?.credits || 0).toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Available balance</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass md:col-span-2 h-[450px]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Volume Trends (14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }} />
                  <Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorVol)" strokeWidth={3} />
                  <Area type="monotone" dataKey="success" stroke="hsl(var(--accent))" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground italic text-sm">Insufficient data for trend analysis.</div>
            )}
          </CardContent>
          <div className="px-6 flex gap-4 text-[10px] font-bold uppercase text-muted-foreground">
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-primary/20 border border-primary rounded-sm" /> Attempted</div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 border border-accent border-dashed rounded-sm" /> Delivered</div>
          </div>
        </Card>

        <Card className="glass h-[450px] flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-accent" />
              Campaign Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-0">
            {campaignBreakdown.length > 0 ? (
              <>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={campaignBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {campaignBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="px-6 pb-6 grid grid-cols-2 gap-x-4 gap-y-2 w-full">
                  {campaignBreakdown.map((t, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{t.name}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold">{t.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground italic text-sm py-20 flex flex-col items-center gap-2 opacity-20">
                <Target className="w-12 h-12" />
                No outreach data.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass bg-destructive/5 border-destructive/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Reliability & Health
          </CardTitle>
          <CardDescription>Network-level monitoring for carrier reachability.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-8">
           <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Handset Reachability</p>
              <div className="text-2xl font-bold text-destructive">{100 - stats.deliveryRate}% Latency</div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
                 <div className="h-full bg-destructive" style={{ width: `${100 - stats.deliveryRate}%` }} />
              </div>
           </div>
           <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Success vs Fail</p>
              <div className="text-2xl font-bold text-accent">{stats.sent} / {stats.failed}</div>
              <p className="text-[9px] text-muted-foreground italic">Dispatched vs Errored messages.</p>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
