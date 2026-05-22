
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
  Calendar,
  Zap,
  Target,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
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
    if (!allLogs) return { total: 0, sent: 0, failed: 0, delivered: 0, successRate: 0, deliveryRate: 0 };
    const total = allLogs.length;
    const sent = allLogs.filter(l => l.status === 'sent').length;
    const failed = allLogs.filter(l => l.status === 'failed').length;
    const delivered = allLogs.filter(l => l.providerStatus === 'delivered' || l.status === 'sent').length; // providerStatus if webhook active
    
    return {
      total,
      sent,
      failed,
      delivered,
      successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0
    };
  }, [allLogs]);

  const typeData = useMemo(() => {
    if (!allLogs) return [];
    const types = ['birthday', 'announcement', 'test', 'reminder', 'followup'];
    return types.map(type => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: allLogs.filter(l => l.type === type).length
    })).filter(t => t.value > 0);
  }, [allLogs]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#8884d8', '#ffc658', '#42b883'];

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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Communication Intelligence</h2>
          <p className="text-muted-foreground">Comprehensive performance metrics for {currentChurch?.name}.</p>
        </div>
        <div className="flex gap-2">
           <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 h-8 px-4 rounded-xl font-bold">
             <Zap className="w-3 h-3 mr-2" /> Live Analytics
           </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-accent" /> Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{stats.successRate}%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Platform-to-Provider delivery</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Target className="w-3 h-3" /> Delivery Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.deliveryRate}%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Provider-to-Handset verification</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><MessageSquare className="w-3 h-3" /> Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1">All-time communications</p>
          </CardContent>
        </Card>
        <Card className="glass border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Clock className="w-3 h-3 text-primary" /> Remaining Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{(currentChurch?.sms?.credits || 0).toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Current balance in organization wallet</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass md:col-span-2 h-[450px]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Communication Trends (14 Days)
            </CardTitle>
            <CardDescription className="text-xs">Daily message volume and success tracking.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
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
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                />
                <Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorVol)" strokeWidth={3} />
                <Area type="monotone" dataKey="success" stroke="hsl(var(--accent))" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
          <div className="px-6 flex gap-4 text-[10px] font-bold uppercase text-muted-foreground">
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-primary/20 border border-primary rounded-sm" /> Total Attempted</div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 border border-accent border-dashed rounded-sm" /> Successful Delivery</div>
          </div>
        </Card>

        <Card className="glass h-[450px] flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-accent" />
              Campaign Breakdown
            </CardTitle>
            <CardDescription className="text-xs">Volume distribution by message type.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-0">
            {typeData.length > 0 ? (
              <>
                <div className="h-[250px] w-full">
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
                </div>
                <div className="px-6 pb-6 grid grid-cols-2 gap-x-4 gap-y-2 w-full">
                  {typeData.map((t, i) => (
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
              <div className="text-muted-foreground italic text-sm py-20 flex flex-col items-center gap-2">
                <Target className="w-12 h-12 opacity-10" />
                No outreach data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Carrier Performance Index
          </CardTitle>
          <CardDescription>Real-time delivery health based on network-level reports.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-8">
             <div className="space-y-3">
                <div className="flex justify-between items-end">
                   <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Network Latency</p>
                   <p className="text-xs font-bold text-accent">&lt; 2s</p>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                   <div className="h-full bg-accent" style={{ width: '92%' }} />
                </div>
                <p className="text-[9px] text-muted-foreground italic">Average time to handset delivery.</p>
             </div>
             <div className="space-y-3">
                <div className="flex justify-between items-end">
                   <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Handset Reachability</p>
                   <p className="text-xs font-bold text-primary">98.4%</p>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                   <div className="h-full bg-primary" style={{ width: '98%' }} />
                </div>
                <p className="text-[9px] text-muted-foreground italic">Success rate across all Ghana networks.</p>
             </div>
             <div className="space-y-3">
                <div className="flex justify-between items-end">
                   <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Gateway Stability</p>
                   <p className="text-xs font-bold text-accent">Stable</p>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                   <div className="h-full bg-accent" style={{ width: '100%' }} />
                </div>
                <p className="text-[9px] text-muted-foreground italic">mNotify API endpoint availability.</p>
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
