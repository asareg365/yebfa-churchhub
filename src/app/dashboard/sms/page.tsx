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
  MessageSquare
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
import { startOfDay, startOfMonth } from 'date-fns';

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
  
  const { data: allLogs } = useCollection(logsRef ? query(logsRef, orderBy('createdAt', 'desc')) : null);

  // Derived Stats
  const stats = useMemo(() => {
    if (!allLogs || !currentChurch) return { today: 0, failed: 0, monthly: 0, remaining: 0 };
    const today = startOfDay(new Date());
    const month = startOfMonth(new Date());

    const sub = currentChurch.subscription || { smsCredits: 0, smsUsed: 0 };

    return {
      today: allLogs.filter(l => l.createdAt?.toDate() >= today && l.status === 'sent').length,
      failed: allLogs.filter(l => l.createdAt?.toDate() >= today && l.status === 'failed').length,
      monthly: allLogs.filter(l => l.createdAt?.toDate() >= month && l.status === 'sent').length,
      remaining: Math.max(0, sub.smsCredits - sub.smsUsed)
    };
  }, [allLogs, currentChurch]);

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
        phone: '0240000000', // Default test number
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
          <p className="text-muted-foreground">Quick overview and drafting tools for {currentChurch?.name}.</p>
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
    </div>
  );
}
