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
  Clock,
  Layout,
  History,
  Info,
  Calendar,
  Filter,
  Users,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { aiCommunicationAssistant } from '@/ai/flows/ai-communication-assistant';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, addDoc, serverTimestamp, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { sendAndLogSMS, processBirthdaysToday } from '@/services/sms-service';
import { startOfDay, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Sub-page components
import SMSLogsPage from './logs/page';
import FailedMessagesPage from './failed/page';
import SMSTemplatesPage from './templates/page';

export default function SMSCenterHub() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('all members');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isProcessingBirthdays, setIsProcessingBirthdays] = useState(false);
  const [draft, setDraft] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const smsRef = useMemo(() => currentChurch?.id ? collection(db, 'churches', currentChurch.id, 'smsLogs') : null, [db, currentChurch?.id]);
  const campaignRef = useMemo(() => currentChurch?.id ? collection(db, 'churches', currentChurch.id, 'scheduledSms') : null, [db, currentChurch?.id]);
  
  const { data: allLogs } = useCollection(smsRef ? query(smsRef, orderBy('createdAt', 'desc'), limit(100)) : null);
  const { data: campaigns } = useCollection(campaignRef ? query(campaignRef, orderBy('scheduledAt', 'desc')) : null);

  const stats = useMemo(() => {
    const sms = currentChurch?.sms || { credits: 0, enabled: false, subscriptionStatus: 'pending' };
    if (!allLogs) return { today: 0, failed: 0, remaining: sms.credits, enabled: sms.enabled, status: sms.subscriptionStatus };
    
    const today = startOfDay(new Date());
    const logsToday = allLogs.filter(l => {
      const d = l.createdAt?.toDate?.() || new Date(l.createdAt);
      return d >= today;
    });

    return {
      today: logsToday.filter(l => l.status === 'sent' || l.status === 'delivered').length,
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

  const handleScheduleCampaign = async () => {
    if (!draft || !scheduledAt || !campaignRef) return;
    setIsScheduling(true);
    try {
      await addDoc(campaignRef, {
        message: draft,
        target: targetAudience,
        scheduledAt: new Date(scheduledAt),
        status: 'pending',
        createdAt: serverTimestamp()
      });
      toast({ title: 'Campaign Scheduled', description: 'Message queued for automatic delivery.' });
      setDraft('');
      setScheduledAt('');
      setActiveTab('campaigns');
    } catch (e: any) {
      toast({ title: 'Scheduling failed', variant: 'destructive' });
    } finally {
      setIsScheduling(false);
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
      if (outcome.success) toast({ title: 'Test SMS Sent Successfully' });
      else toast({ title: 'Send Failed', description: outcome.error, variant: 'destructive' });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setIsSending(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">SMS Center</h2>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-sm">Communication management for {currentChurch?.name}.</p>
            <Badge className={cn("text-[10px] py-0", stats.status === 'active' ? "bg-accent" : "bg-amber-500")}>
              Service: {stats.status.toUpperCase()}
            </Badge>
          </div>
        </div>
        <Button variant="outline" className="w-full md:w-auto glass border-primary/20 text-primary" onClick={() => processBirthdaysToday(db, currentChurch!.id)} disabled={isProcessingBirthdays || stats.status !== 'active'}>
          {isProcessingBirthdays ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cake className="w-4 h-4 mr-2" />}
          Run Birthday Check
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="w-full overflow-x-auto hide-scrollbar pb-1">
          <TabsList className="glass border-white/10 p-1 rounded-2xl w-fit min-w-full inline-flex md:w-auto">
            <TabsTrigger value="dashboard" className="rounded-xl px-6 shrink-0"><MessageSquare className="w-4 h-4 mr-2" />Dashboard</TabsTrigger>
            <TabsTrigger value="campaigns" className="rounded-xl px-6 shrink-0"><Calendar className="w-4 h-4 mr-2" />Campaigns</TabsTrigger>
            <TabsTrigger value="logs" className="rounded-xl px-6 shrink-0"><History className="w-4 h-4 mr-2" />Logs</TabsTrigger>
            <TabsTrigger value="failed" className="rounded-xl px-6 shrink-0"><AlertTriangle className="w-4 h-4 mr-2" />Failed</TabsTrigger>
            <TabsTrigger value="templates" className="rounded-xl px-6 shrink-0"><Layout className="w-4 h-4 mr-2" />Templates</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="glass"><CardContent className="pt-6"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Available Credits</p><h3 className="text-xl md:text-2xl font-bold text-primary">{stats.remaining.toLocaleString()}</h3></CardContent></Card>
            <Card className="glass"><CardContent className="pt-6"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sent Today</p><h3 className="text-xl md:text-2xl font-bold text-accent">{stats.today}</h3></CardContent></Card>
            <Card className="glass"><CardContent className="pt-6"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Failures Today</p><h3 className="text-xl md:text-2xl font-bold text-destructive">{stats.failed}</h3></CardContent></Card>
            <Card className="glass"><CardContent className="pt-6"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</p><h3 className="text-xl md:text-2xl font-bold capitalize">{stats.status}</h3></CardContent></Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass border-primary/20 shadow-xl flex flex-col">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />AI Message Builder</CardTitle>
                <CardDescription>Tailor your announcements for maximum impact.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Announcement Topic</Label>
                    <Input placeholder="e.g. Youth Prayer Night" value={topic} onChange={(e) => setTopic(e.target.value)} className="bg-muted/30 h-11"/>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Group</Label>
                    <Select value={targetAudience} onValueChange={setTargetAudience}>
                      <SelectTrigger className="bg-muted/30 h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all members">Entire Congregation</SelectItem>
                        <SelectItem value="Youth">Youth Department</SelectItem>
                        <SelectItem value="Music">Music Team</SelectItem>
                        <SelectItem value="Media">Media Department</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full bg-primary h-11 rounded-xl" onClick={handleGenerate} disabled={isGenerating || stats.status !== 'active'}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate with AI
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass flex flex-col shadow-xl">
              <CardHeader className="bg-muted/10 border-b"><CardTitle className="text-lg">Scheduling & Sending</CardTitle></CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col">
                <Textarea className="flex-1 p-6 bg-transparent border-0 resize-none min-h-[180px] focus-visible:ring-0" placeholder="Your message draft..." value={draft} onChange={(e) => setDraft(e.target.value)}/>
                <div className="p-4 bg-muted/20 border-t space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Schedule for later (Optional)</Label>
                    <div className="flex gap-2">
                       <Input type="datetime-local" className="bg-white h-11 rounded-xl" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                       <Button className="bg-primary px-6 rounded-xl shrink-0" onClick={handleScheduleCampaign} disabled={!draft || !scheduledAt || isScheduling}>
                         {isScheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                       </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={handleSendTest} disabled={!draft || isSending}>
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send Test SMS
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns">
           <Card className="glass overflow-hidden">
             <CardHeader className="bg-muted/20 border-b">
               <CardTitle>Scheduled Campaigns</CardTitle>
               <CardDescription>Track pending and completed bulk announcements.</CardDescription>
             </CardHeader>
             <CardContent className="p-0">
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-muted/10 text-muted-foreground border-b border-border">
                        <tr>
                          <th className="p-4 font-bold text-[10px] uppercase">Message</th>
                          <th className="p-4 font-bold text-[10px] uppercase">Target</th>
                          <th className="p-4 font-bold text-[10px] uppercase">Scheduled</th>
                          <th className="p-4 font-bold text-[10px] uppercase">Status</th>
                          <th className="p-4 font-bold text-[10px] uppercase text-right">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border">
                        {campaigns?.map(camp => (
                          <tr key={camp.id} className="hover:bg-muted/5 transition-colors">
                            <td className="p-4 max-w-[200px] truncate font-medium">{camp.message}</td>
                            <td className="p-4"><Badge variant="outline" className="capitalize text-[10px]">{camp.target}</Badge></td>
                            <td className="p-4 text-xs">
                              {camp.scheduledAt?.toDate ? format(camp.scheduledAt.toDate(), 'MMM d, HH:mm') : 'N/A'}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                <Badge className={cn(
                                  "text-[9px] font-bold uppercase w-fit",
                                  camp.status === 'completed' ? "bg-accent" : 
                                  camp.status === 'failed' ? "bg-destructive" : "bg-primary"
                                )}>
                                  {camp.status}
                                </Badge>
                                {camp.error && <span className="text-[9px] text-destructive truncate max-w-[150px]">{camp.error}</span>}
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              {camp.status !== 'completed' && (
                                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 rounded-lg" onClick={() => deleteDoc(doc(campaignRef!, camp.id))}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {campaigns?.length === 0 && (
                          <tr><td colSpan={5} className="p-20 text-center text-muted-foreground italic">No campaigns scheduled.</td></tr>
                        )}
                     </tbody>
                   </table>
                </div>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="logs"><SMSLogsPage /></TabsContent>
        <TabsContent value="failed"><FailedMessagesPage /></TabsContent>
        <TabsContent value="templates"><SMSTemplatesPage /></TabsContent>
      </Tabs>
    </div>
  );
}