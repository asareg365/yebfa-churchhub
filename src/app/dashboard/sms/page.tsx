
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
  BarChart3,
  Clock,
  CreditCard,
  Layout,
  History,
  TrendingDown,
  Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { aiCommunicationAssistant } from '@/ai/flows/ai-communication-assistant';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { sendAndLogSMS, processBirthdaysToday } from '@/services/sms-service';
import { startOfDay, startOfMonth, format, subDays } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Sub-page components
import SMSLogsPage from './logs/page';
import FailedMessagesPage from './failed/page';
import SMSTemplatesPage from './templates/page';
import SMSAnalyticsPage from './analytics/page';

export default function SMSCenterHub() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('all members');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isProcessingBirthdays, setIsProcessingBirthdays] = useState(false);
  const [draft, setDraft] = useState('');

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const smsRef = useMemo(() => currentChurch?.id ? collection(db, 'churches', currentChurch.id, 'smsLogs') : null, [db, currentChurch?.id]);
  const { data: allLogs } = useCollection(smsRef ? query(smsRef, orderBy('createdAt', 'desc'), limit(100)) : null);

  const stats = useMemo(() => {
    const sms = currentChurch?.sms || { credits: 0, enabled: false, subscriptionStatus: 'pending' };
    if (!allLogs) return { today: 0, failed: 0, remaining: sms.credits, enabled: sms.enabled, status: sms.subscriptionStatus };
    const today = startOfDay(new Date());
    const logsToday = allLogs.filter(l => l.createdAt?.toDate?.() >= today);
    return {
      today: logsToday.filter(l => l.status === 'sent').length,
      failed: logsToday.filter(l => l.status === 'failed').length,
      remaining: sms.credits || 0,
      enabled: sms.enabled,
      status: sms.subscriptionStatus
    };
  }, [allLogs, currentChurch]);

  const handleGenerate = async () => {
    if (!topic) return toast({ title: 'Topic required', variant: 'destructive' });
    setIsGenerating(true);
    try {
      const result = await aiCommunicationAssistant({ topic, targetAudience });
      setDraft(result.draftMessage);
      toast({ title: 'AI Draft Ready' });
    } catch (e) {
      toast({ title: 'Generation failed', variant: 'destructive' });
    } finally { setIsGenerating(false); }
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
      if (outcome.success) toast({ title: 'SMS Sent Successfully' });
      else toast({ title: 'Send Failed', description: outcome.error, variant: 'destructive' });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setIsSending(false); }
  };

  const handleRunBirthdayCheck = async () => {
    if (!currentChurch?.id) return;
    setIsProcessingBirthdays(true);
    try {
      const results = await processBirthdaysToday(db, currentChurch.id);
      toast({ title: 'Process Complete', description: `Sent: ${results.sent}, Failed: ${results.failed}` });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setIsProcessingBirthdays(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">SMS Center</h2>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-sm">Communication management for {currentChurch?.name}.</p>
            <Badge className={cn("text-[10px] py-0", stats.status === 'active' ? "bg-accent" : "bg-amber-500")}>
              Service: {stats.status.toUpperCase()}
            </Badge>
          </div>
        </div>
        <Button variant="outline" className="glass border-primary/20 text-primary" onClick={handleRunBirthdayCheck} disabled={isProcessingBirthdays || stats.status !== 'active'}>
          {isProcessingBirthdays ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cake className="w-4 h-4 mr-2" />}
          Run Birthday Check
        </Button>
      </div>

      {stats.status !== 'active' && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="py-4">
            <div className="flex items-center gap-3 text-amber-800">
              <Info className="h-5 w-5" />
              <div>
                <CardTitle className="text-sm font-bold">Service Approval Pending</CardTitle>
                <CardDescription className="text-amber-700 text-xs">
                  Your SMS service is awaiting activation by the System Administrator. Manual sending and automation will be enabled once approved.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="dashboard" className="rounded-xl px-6"><MessageSquare className="w-4 h-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl px-6"><History className="w-4 h-4 mr-2" />Logs</TabsTrigger>
          <TabsTrigger value="failed" className="rounded-xl px-6"><AlertTriangle className="w-4 h-4 mr-2" />Failed</TabsTrigger>
          <TabsTrigger value="templates" className="rounded-xl px-6"><Layout className="w-4 h-4 mr-2" />Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="glass"><CardContent className="pt-6"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Available Credits</p><h3 className="text-2xl font-bold text-primary">{stats.remaining.toLocaleString()}</h3></CardContent></Card>
            <Card className="glass"><CardContent className="pt-6"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sent Today</p><h3 className="text-2xl font-bold text-accent">{stats.today}</h3></CardContent></Card>
            <Card className="glass"><CardContent className="pt-6"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Failures</p><h3 className="text-2xl font-bold text-destructive">{stats.failed}</h3></CardContent></Card>
            <Card className="glass"><CardContent className="pt-6"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Service Health</p><h3 className="text-2xl font-bold">{stats.enabled ? 'Active' : 'Offline'}</h3></CardContent></Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass border-primary/20 shadow-xl overflow-hidden flex flex-col">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />AI Campaign Assistant</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4 flex-1">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Message Topic</Label>
                    <Input placeholder="e.g. 2026 Easter Convention" value={topic} onChange={(e) => setTopic(e.target.value)} className="bg-muted/30 h-11"/>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Audience</Label>
                    <Select value={targetAudience} onValueChange={setTargetAudience}>
                      <SelectTrigger className="bg-muted/30 h-11"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all members">All Members</SelectItem><SelectItem value="youth group">Youth Group</SelectItem><SelectItem value="church elders">Church Elders</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full bg-primary h-11" onClick={handleGenerate} disabled={isGenerating || stats.status !== 'active'}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate Draft
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/10 border-b"><CardTitle className="text-lg">Message Editor</CardTitle></CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col">
                <Textarea className="flex-1 p-6 bg-transparent border-0 resize-none min-h-[180px] focus-visible:ring-0" placeholder="Type or generate your message..." value={draft} onChange={(e) => setDraft(e.target.value)}/>
                <div className="p-4 bg-muted/20 border-t flex gap-2">
                  <Button className="flex-1 bg-accent" onClick={handleSendTest} disabled={!draft || isSending || stats.status !== 'active'}>
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Send Test SMS
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs"><SMSLogsPage /></TabsContent>
        <TabsContent value="failed"><FailedMessagesPage /></TabsContent>
        <TabsContent value="templates"><SMSTemplatesPage /></TabsContent>
      </Tabs>
    </div>
  );
}
