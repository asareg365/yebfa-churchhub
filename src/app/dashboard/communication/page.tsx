
'use client';

import { useState, useMemo } from 'react';
import { 
  Send, 
  Sparkles, 
  Users, 
  MessageSquare, 
  Megaphone, 
  Loader2, 
  Mail, 
  Layout, 
  History, 
  Cake,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  TrendingUp,
  AlertTriangle,
  Wallet,
  Calendar,
  Filter,
  Search
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { aiCommunicationAssistant } from '@/ai/flows/ai-communication-assistant';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, addDoc, serverTimestamp, deleteDoc, doc, orderBy, getDocs } from 'firebase/firestore';
import { sendAndLogSMS, processBirthdaysToday } from '@/services/sms-service';
import { format, startOfDay, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

export default function CommunicationPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('all members');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isProcessingBirthdays, setIsProcessingBirthdays] = useState(false);
  const [draft, setDraft] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

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
  
  const { data: templates } = useCollection(templatesRef ? query(templatesRef) : null);
  const { data: allLogs, loading: logsLoading } = useCollection(logsRef ? query(logsRef, orderBy('createdAt', 'desc')) : null);

  // Derived Stats
  const stats = useMemo(() => {
    if (!allLogs) return { today: 0, failed: 0, monthly: 0, remaining: 2500 }; // Remaining is placeholder
    const today = startOfDay(new Date());
    const month = startOfMonth(new Date());

    return {
      today: allLogs.filter(l => l.createdAt?.toDate() >= today && l.status === 'sent').length,
      failed: allLogs.filter(l => l.createdAt?.toDate() >= today && l.status === 'failed').length,
      monthly: allLogs.filter(l => l.createdAt?.toDate() >= month && l.status === 'sent').length,
      remaining: 2500 - allLogs.length // Simple simulation
    };
  }, [allLogs]);

  // Filtered Logs for Table
  const filteredLogs = useMemo(() => {
    if (!allLogs) return [];
    return allLogs.filter(log => {
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      const matchesType = typeFilter === 'all' || log.type === typeFilter;
      const matchesSearch = log.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           log.phone?.includes(searchTerm);
      return matchesStatus && matchesType && matchesSearch;
    }).slice(0, 50);
  }, [allLogs, statusFilter, typeFilter, searchTerm]);

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
      }
    } catch (error) {
      toast({ title: 'Failed to send test', variant: 'destructive' });
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
    } catch (error) {
      toast({ title: 'Birthday process failed', variant: 'destructive' });
    } finally {
      setIsProcessingBirthdays(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Communications</h2>
          <p className="text-muted-foreground">Manage automated greetings and custom campaigns for {currentChurch?.name}.</p>
        </div>
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass border-accent/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sent Today</p>
                <h3 className="text-2xl font-bold mt-1">{stats.today}</h3>
              </div>
              <div className="p-3 bg-accent/10 rounded-xl text-accent">
                <Send className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-destructive/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Failed SMS</p>
                <h3 className="text-2xl font-bold mt-1">{stats.failed}</h3>
              </div>
              <div className="p-3 bg-destructive/10 rounded-xl text-destructive">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Monthly Usage</p>
                <h3 className="text-2xl font-bold mt-1">{stats.monthly}</h3>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-muted">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Credits Left</p>
                <h3 className="text-2xl font-bold mt-1">{stats.remaining}</h3>
              </div>
              <div className="p-3 bg-muted rounded-xl text-muted-foreground">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="assistant" className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="assistant" className="rounded-xl px-6">
            <Sparkles className="w-4 h-4 mr-2" /> AI Assistant
          </TabsTrigger>
          <TabsTrigger value="templates" className="rounded-xl px-6">
            <Layout className="w-4 h-4 mr-2" /> Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl px-6">
            <History className="w-4 h-4 mr-2" /> SMS Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assistant" className="animate-in fade-in-50 duration-500">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass border-primary/20 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  AI Draft Assistant
                </CardTitle>
                <CardDescription>Generate tailored messages for any audience.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Main Topic</Label>
                  <Input 
                    placeholder="e.g., Anniversary Celebration" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="bg-muted/30 rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select value={targetAudience} onValueChange={setTargetAudience}>
                    <SelectTrigger className="bg-muted/30 rounded-xl h-11">
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent className="glass">
                      <SelectItem value="all members">All Members</SelectItem>
                      <SelectItem value="youth group">Youth Group</SelectItem>
                      <SelectItem value="church elders">Church Elders</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full bg-primary text-primary-foreground h-12 rounded-xl shadow-lg shadow-primary/20" 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate Draft
                </Button>
              </CardContent>
            </Card>

            <Card className="glass overflow-hidden flex flex-col shadow-xl">
              <CardHeader className="bg-primary/5 border-b border-border">
                <CardTitle className="text-lg">Message Workspace</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 flex flex-col">
                <Textarea 
                  className="flex-1 p-6 bg-transparent border-0 focus-visible:ring-0 resize-none min-h-[300px]"
                  placeholder="Your draft will appear here..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="p-4 border-t border-border bg-muted/20 flex gap-2">
                  <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={handleSaveAsTemplate} disabled={!draft}>
                    Save Template
                  </Button>
                  <Button className="flex-1 bg-accent text-white h-11 rounded-xl shadow-lg shadow-accent/20" onClick={handleSendTest} disabled={!draft || isSending}>
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send Test SMS
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="animate-in fade-in-50 duration-500">
          <div className="grid gap-4 md:grid-cols-3">
            {templates?.map((t) => (
              <Card key={t.id} className="glass hover:border-primary/30 transition-all group">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">{t.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-4">{t.content}</p>
                </CardContent>
                <CardFooter className="flex justify-between border-t border-border pt-4">
                  <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10" onClick={() => setDraft(t.content)}>
                    <Copy className="w-3 h-3 mr-1" /> Use
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => deleteDoc(doc(templatesRef!, t.id))}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
            {templates?.length === 0 && (
              <div className="col-span-full py-20 text-center opacity-40">
                <Layout className="w-12 h-12 mx-auto mb-4" />
                <p>No templates saved yet.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="animate-in fade-in-50 duration-500">
          <Card className="glass overflow-hidden shadow-xl border-border">
            <CardHeader className="bg-muted/20 border-b border-border space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <CardTitle className="text-lg">SMS Delivery Logs</CardTitle>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search recipient..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10 rounded-xl"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32 h-10 rounded-xl">
                      <Filter className="w-3 h-3 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-32 h-10 rounded-xl">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="announcement">Announcement</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <div className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/10 text-muted-foreground">
                    <tr>
                      <th className="p-4 font-bold uppercase tracking-wider text-xs">Member</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-xs">Phone</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-xs">Type</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-xs">Status</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLogs?.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/5 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-foreground">{log.memberName || 'Guest Recipient'}</div>
                        </td>
                        <td className="p-4">
                          <code className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">{log.phone}</code>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="capitalize text-[10px] bg-white">
                            {log.type}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              log.status === 'sent' ? 'bg-accent animate-pulse' : 
                              log.status === 'failed' ? 'bg-destructive' : 'bg-amber-400'
                            )} />
                            <span className={cn(
                              "font-medium capitalize",
                              log.status === 'sent' ? 'text-accent' : 
                              log.status === 'failed' ? 'text-destructive' : 'text-amber-600'
                            )}>
                              {log.status}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground text-right">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">
                              {log.createdAt?.toDate ? format(log.createdAt.toDate(), 'MMM d, yyyy') : '...'}
                            </span>
                            <span>
                              {log.createdAt?.toDate ? format(log.createdAt.toDate(), 'HH:mm') : 'Recently'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredLogs?.length === 0 && !logsLoading && (
                      <tr>
                        <td colSpan={5} className="p-20 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2 opacity-40">
                            <History className="w-12 h-12" />
                            <p>No matching logs found.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
