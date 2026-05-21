'use client';

import { useState, useMemo } from 'react';
import { 
  Send, 
  Sparkles, 
  Loader2, 
  Cake,
  TrendingUp,
  AlertTriangle,
  Wallet,
  MessageSquare,
  TrendingDown,
  BarChart3,
  Clock,
  CreditCard
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { aiCommunicationAssistant } from '@/ai/flows/ai-communication-assistant';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { sendAndLogSMS, processBirthdaysToday } from '@/services/sms-service';
import { startOfDay, startOfMonth, format, subDays } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function SMSDashboardPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('all members');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isProcessingBirthdays, setIsProcessingBirthdays] = useState(false);
  const [draft, setDraft] = useState('');

  // Tenant Context
  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  // Data Collections
  const templatesRef = useMemo(() => currentChurch?.id ? collection(db, 'churches', currentChurch.id, 'smsTemplates') : null, [db, currentChurch?.id]);
  const logsRef = useMemo(() => currentChurch?.id ? collection(db, 'churches', currentChurch.id, 'smsLogs') : null, [db, currentChurch?.id]);
  
  const { data: allLogs } = useCollection(logsRef ? query(logsRef, orderBy('createdAt', 'desc'), limit(100)) : null);

  // Derived Stats
  const stats = useMemo(() => {
    if (!allLogs || !currentChurch) return { today: 0, failed: 0, monthly: 0, remaining: 0, pendingRetry: 0, totalCost: 0 };
    const today = startOfDay(new Date());
    const month = startOfMonth(new Date());

    const sub = currentChurch.subscription || { smsCredits: 0, smsUsed: 0 };

    const logsToday = allLogs.filter(l => l.createdAt?.toDate?.() >= today);
    const sentToday = logsToday.filter(l => l.status === 'sent').length;
    const failedToday = logsToday.filter(l => l.status === 'failed').length;
    
    return {
      today: sentToday,
      failed: failedToday,
      monthly: allLogs.filter(l => l.createdAt?.toDate?.() >= month && l.status === 'sent').length,
      remaining: Math.max(0, sub.smsCredits - sub.smsUsed),
      pendingRetry: allLogs.filter(l => l.status === 'failed' && (l.retryCount || 0) < 3).length,
      totalCost: sub.smsUsed // 1 Credit = 1 Cost unit
    };
  }, [allLogs, currentChurch]);

  // Chart Data Preparation
  const chartData = useMemo(() => {
    if (!allLogs) return [];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), i);
      return format(d, 'MMM dd');
    }).reverse();

    return last7Days.map(day => {
      const dayLogs = allLogs.filter(l => l.createdAt?.toDate && format(l.createdAt.toDate(), 'MMM dd') === day);
      return {
        name: day,
        sent: dayLogs.filter(l => l.status === 'sent').length,
        failed: dayLogs.filter(l => l.status === 'failed').length,
      };
    });
  }, [allLogs]);

  const handleGenerate = async () => {
    if (!topic) {
      toast({ title: 'Topic required', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await aiCommunicationAssistant({ topic, targetAudience });
      setDraft(result.draftMessage);
      toast({ title: 'Draft generated successfully!' });
    } catch (error) {
      toast({ title: 'Generation failed', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendTest = async () => {
    if (!draft || !currentChurch?.id) return;
    setIsSending(true);
    try {
      const outcome = await sendAndLogSMS(db, currentChurch.id, {
        phone: '0240000000',
        message: draft,
        type: 'test'
      });
      if (outcome.success) {
        toast({ title: 'Test SMS queued', description: 'Check logs for status.' });
      } else {
        toast({ title: 'Delivery failed', description: outcome.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Failed to send test', description: error.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!draft || !templatesRef) return;
    try {
      await addDoc(templatesRef, {
        name: topic || 'New Template',
        content: draft,
        createdAt: serverTimestamp()
      });
      toast({ title: 'Template saved' });
    } catch (error) {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const handleRunBirthdayCheck = async () => {
    if (!currentChurch?.id) return;
    setIsProcessingBirthdays(true);
    try {
      const results = await processBirthdaysToday(db, currentChurch.id);
      toast({ 
        title: 'Birthday check complete', 
        description: `Sent: ${results.sent}, Failed: ${results.failed}, Skipped: ${results.skipped}` 
      });
    } catch (error: any) {
      toast({ title: 'Birthday process failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessingBirthdays(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">SMS Dashboard</h2>
          <p className="text-muted-foreground">Monitoring communication performance for {currentChurch?.name}.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="glass border-primary/20 hover:bg-primary/10 text-primary"
            onClick={handleRunBirthdayCheck}
            disabled={isProcessingBirthdays || !currentChurch}
          >
            {isProcessingBirthdays ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cake className="w-4 h-4 mr-2" />}
            Run Birthday Check
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="glass border-accent/20">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sent Today</p>
              <h3 className="text-2xl font-bold text-accent">{stats.today}</h3>
              <div className="flex items-center text-[10px] text-accent">
                <TrendingUp className="w-3 h-3 mr-1" /> Healthy
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-destructive/20">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Failed Today</p>
              <h3 className="text-2xl font-bold text-destructive">{stats.failed}</h3>
              <div className="flex items-center text-[10px] text-destructive">
                <AlertTriangle className="w-3 h-3 mr-1" /> Check Logs
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-amber-500/20">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pending Retry</p>
              <h3 className="text-2xl font-bold text-amber-600">{stats.pendingRetry}</h3>
              <div className="flex items-center text-[10px] text-amber-600">
                <Clock className="w-3 h-3 mr-1" /> In Queue
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-primary/20">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Credits Left</p>
              <h3 className="text-2xl font-bold text-primary">{stats.remaining}</h3>
              <div className="flex items-center text-[10px] text-primary">
                <Wallet className="w-3 h-3 mr-1" /> Available
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Usage</p>
              <h3 className="text-2xl font-bold">{stats.monthly}</h3>
              <div className="flex items-center text-[10px] text-muted-foreground">
                <BarChart3 className="w-3 h-3 mr-1" /> 30-Day Trend
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Credits</p>
              <h3 className="text-2xl font-bold">{stats.totalCost}</h3>
              <div className="flex items-center text-[10px] text-muted-foreground">
                <CreditCard className="w-3 h-3 mr-1" /> Lifetime
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass h-[400px]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Activity Trends (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                />
                <Area type="monotone" dataKey="sent" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorSent)" strokeWidth={3} />
                <Area type="monotone" dataKey="failed" stroke="hsl(var(--destructive))" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass flex flex-col">
          <CardHeader className="bg-primary/5 border-b border-border">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Draft Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Main Topic</Label>
                <Input 
                  placeholder="e.g. Easter Youth Camp" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Select value={targetAudience} onValueChange={setTargetAudience}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass">
                    <SelectItem value="all members">All Members</SelectItem>
                    <SelectItem value="youth group">Youth Group</SelectItem>
                    <SelectItem value="church elders">Church Elders</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea 
              className="min-h-[120px] bg-muted/20 border-0 focus-visible:ring-0 resize-none rounded-xl"
              placeholder="Your AI draft will appear here..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-primary text-primary-foreground h-11" 
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate Draft
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleSaveAsTemplate} disabled={!draft}>
                Save Template
              </Button>
              <Button className="bg-accent text-white" onClick={handleSendTest} disabled={!draft || isSending}>
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}