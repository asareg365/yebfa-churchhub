
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
  Copy
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
import { collection, query, where, limit, addDoc, serverTimestamp, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { sendAndLogSMS, processBirthdaysToday } from '@/services/sms-service';
import { format } from 'date-fns';

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
  const { data: logs, loading: logsLoading } = useCollection(logsRef ? query(logsRef, orderBy('createdAt', 'desc'), limit(20)) : null);

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
      // Using admin's phone if available, else a placeholder
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
            <Card className="glass border-primary/20">
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
                    className="bg-white/5 rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select value={targetAudience} onValueChange={setTargetAudience}>
                    <SelectTrigger className="bg-white/5 rounded-xl h-11">
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
                  className="w-full bg-primary text-primary-foreground h-12 rounded-xl" 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate Draft
                </Button>
              </CardContent>
            </Card>

            <Card className="glass overflow-hidden flex flex-col">
              <CardHeader className="bg-primary/5 border-b border-white/5">
                <CardTitle className="text-lg">Message Workspace</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 flex flex-col">
                <Textarea 
                  className="flex-1 p-6 bg-transparent border-0 focus-visible:ring-0 resize-none min-h-[300px]"
                  placeholder="Your draft will appear here..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="p-4 border-t border-white/5 bg-white/5 flex gap-2">
                  <Button variant="outline" className="flex-1 h-11" onClick={handleSaveAsTemplate} disabled={!draft}>
                    Save Template
                  </Button>
                  <Button className="flex-1 bg-accent h-11" onClick={handleSendTest} disabled={!draft || isSending}>
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
                <CardFooter className="flex justify-between border-t border-white/5 pt-4">
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
          <Card className="glass overflow-hidden">
            <div className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 text-muted-foreground">
                  <tr>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Recipient</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Message</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Type</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Status</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs?.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="font-bold">{log.memberName || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{log.phone}</div>
                      </td>
                      <td className="p-4 max-w-xs truncate">{log.message}</td>
                      <td className="p-4">
                        <Badge variant="outline" className="capitalize text-[10px]">{log.type}</Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {log.status === 'sent' ? (
                            <CheckCircle2 className="w-3 h-3 text-accent" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-destructive" />
                          )}
                          <span className={log.status === 'sent' ? 'text-accent' : 'text-destructive'}>
                            {log.status}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {log.createdAt?.toDate ? format(log.createdAt.toDate(), 'MMM d, HH:mm') : '...'}
                      </td>
                    </tr>
                  ))}
                  {logs?.length === 0 && !logsLoading && (
                    <tr>
                      <td colSpan={5} className="p-20 text-center text-muted-foreground">No logs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
