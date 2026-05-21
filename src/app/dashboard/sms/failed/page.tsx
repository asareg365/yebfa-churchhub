'use client';

import { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Search,
  Loader2,
  RefreshCcw,
  Clock,
  History,
  Info,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { sendAndLogSMS, SMSLog } from '@/services/sms-service';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function FailedMessagesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);

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

  const failedQuery = useMemo(() => {
    if (!logsRef) return null;
    // Show messages failed within last 3 retries
    return query(logsRef, where('status', '==', 'failed'), orderBy('updatedAt', 'desc'), limit(100));
  }, [logsRef]);

  const { data: failedLogs, loading } = useCollection<SMSLog>(failedQuery);

  const filteredLogs = useMemo(() => {
    if (!failedLogs) return [];
    return failedLogs.filter(log => 
      log.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.phone?.includes(searchTerm)
    );
  }, [failedLogs, searchTerm]);

  const handleRetry = async (log: SMSLog) => {
    if (!currentChurch?.id || !log.id) return;
    setRetryingId(log.id);
    
    try {
      // 1. Update status to retrying immediately
      const logDoc = doc(logsRef!, log.id);
      await updateDoc(logDoc, { 
        status: 'retrying', 
        updatedAt: serverTimestamp(),
        retryCount: (log.retryCount || 0) + 1 
      });

      // 2. Attempt send
      const outcome = await sendAndLogSMS(db, currentChurch.id, {
        phone: log.phone,
        message: log.message,
        type: log.type,
        memberName: log.memberName,
        memberId: log.memberId,
        retryCount: (log.retryCount || 0) + 1
      });

      if (outcome.success) {
        // Remove the original failed log or keep it marked as resolved? 
        // For simplicity, we delete the specific OLD failure record since sendAndLogSMS creates a NEW one
        await deleteDoc(logDoc);
        toast({ title: 'Retry successful', description: 'Message has been delivered.' });
      } else {
        // Update status back to failed with new error
        await updateDoc(logDoc, { 
          status: 'failed', 
          error: outcome.error,
          updatedAt: serverTimestamp() 
        });
        toast({ title: 'Retry failed', description: outcome.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error during retry', description: error.message, variant: 'destructive' });
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAll = async () => {
    if (!filteredLogs.length || isRetryingAll) return;
    setIsRetryingAll(true);
    let successCount = 0;
    
    for (const log of filteredLogs) {
      if ((log.retryCount || 0) < 3) {
        // Individual logic handled in a loop for simplicity
        try {
          const outcome = await sendAndLogSMS(db, currentChurch!.id, {
            phone: log.phone,
            message: log.message,
            type: log.type,
            memberName: log.memberName,
            memberId: log.memberId,
            retryCount: (log.retryCount || 0) + 1
          });
          if (outcome.success) {
            await deleteDoc(doc(logsRef!, log.id!));
            successCount++;
          }
        } catch (e) {}
      }
    }
    
    toast({ title: 'Batch retry complete', description: `Successfully resent ${successCount} messages.` });
    setIsRetryingAll(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1 text-destructive flex items-center gap-3">
            <AlertTriangle className="h-8 w-8" />
            Failed Messages
          </h2>
          <p className="text-muted-foreground">Monitor and manage communication delivery failures.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="destructive" 
            className="h-10 px-6 rounded-xl"
            onClick={handleRetryAll}
            disabled={!filteredLogs.length || isRetryingAll}
          >
            {isRetryingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
            Retry All Eligible
          </Button>
        </div>
      </div>

      <Alert variant="destructive" className="glass bg-destructive/5 border-destructive/20">
        <Info className="h-4 w-4" />
        <AlertTitle className="font-bold">Automated Retries</AlertTitle>
        <AlertDescription className="text-xs">
          The system automatically attempts to resend failed messages up to 3 times within 24 hours. Messages exceeding this limit require manual investigation.
        </AlertDescription>
      </Alert>

      <Card className="glass overflow-hidden shadow-xl border-border">
        <CardHeader className="bg-destructive/5 border-b border-border space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <CardTitle className="text-lg">Delivery Failures</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by recipient..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-white"
              />
            </div>
          </div>
        </CardHeader>
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/10 text-muted-foreground">
                <tr>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Recipient</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Message Preview</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Error Reason</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Retries</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs?.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/5 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{log.memberName || 'Guest'}</div>
                      <div className="text-[10px] text-muted-foreground">{log.phone}</div>
                    </td>
                    <td className="p-4">
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]" title={log.message}>
                        {log.message}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <Badge variant="destructive" className="bg-destructive/10 text-destructive text-[10px] border-0 w-fit">
                          {log.error || 'Provider Timeout'}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground flex items-center">
                          <Clock className="w-2 h-2 mr-1" />
                          Last: {log.updatedAt?.toDate ? format(log.updatedAt.toDate(), 'HH:mm') : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Badge variant={log.retryCount >= 3 ? "secondary" : "outline"} className="text-[10px]">
                          {log.retryCount || 0} / 3
                        </Badge>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="rounded-lg h-8 px-3 border-destructive/20 hover:bg-destructive/10 text-destructive"
                          onClick={() => log.id && deleteDoc(doc(logsRef!, log.id))}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="default" 
                          className="rounded-lg h-8 px-3 bg-primary"
                          onClick={() => handleRetry(log)}
                          disabled={retryingId === log.id || log.retryCount >= 3}
                        >
                          {retryingId === log.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCcw className="w-3 h-3" />
                          )}
                          <span className="ml-1">Retry</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredLogs?.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="p-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <CheckCircle2 className="w-12 h-12 text-accent" />
                        <p>No failed messages requiring attention.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
