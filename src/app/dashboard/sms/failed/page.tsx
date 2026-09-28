'use client';

import { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Search,
  Loader2,
  RefreshCcw,
  Clock,
  Info,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import { useTenant } from "@/context/tenant-context";

export default function FailedMessagesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { currentChurch, loading: churchLoading } = useTenant();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const logsRef = useMemo(() => {
    if (!currentChurch?.id || !db) return null;
    return collection(db, 'churches', currentChurch.id, 'smsLogs');
  }, [db, currentChurch?.id]);

  const failedQuery = useMemo(() => {
    if (!logsRef) return null;
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
    if (!currentChurch?.id || !log.id || !logsRef) return;
    setRetryingId(log.id);
    
    try {
      const logDocRef = doc(logsRef, log.id);
      await updateDoc(logDocRef, { 
        status: 'retrying', 
        updatedAt: serverTimestamp(),
        retryCount: (log.retryCount || 0) + 1 
      });

      const outcome = await sendAndLogSMS(db, currentChurch.id, {
        phone: log.phone,
        message: log.message,
        type: log.type,
        memberName: log.memberName,
        memberId: log.memberId,
        retryCount: (log.retryCount || 0) + 1
      });

      if (outcome.success) {
        await deleteDoc(logDocRef);
        toast({ title: 'Retry successful' });
      } else {
        await updateDoc(logDocRef, { 
          status: 'failed', 
          error: outcome.error,
          updatedAt: serverTimestamp() 
        });
        toast({ title: 'Retry failed', description: outcome.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: "destructive" });
    } finally {
      setRetryingId(null);
    }
  };

  if (churchLoading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <Alert variant="destructive" className="glass bg-destructive/5 border-destructive/20">
        <Info className="h-4 w-4" />
        <AlertTitle className="font-bold">Automated Retries</AlertTitle>
        <AlertDescription className="text-xs">
          The system automatically attempts to resend failed messages up to 3 times. Manual retry is available for permanent failures.
        </AlertDescription>
      </Alert>

      <Card className="glass overflow-hidden shadow-xl border-border">
        <CardHeader className="bg-destructive/5 border-b border-border space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <CardTitle className="text-lg">Delivery Failures</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search recipient..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-white"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{log.message}</p>
                    </td>
                    <td className="p-4">
                      <Badge variant="destructive" className="bg-destructive/10 text-destructive text-[10px] border-0">
                        {log.error || 'Provider Timeout'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-[10px]">
                        {log.retryCount || 0} / 3
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="rounded-lg h-8 w-8 p-0"
                          onClick={() => log.id && logsRef && deleteDoc(doc(logsRef, log.id))}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          className="rounded-lg h-8 px-3 bg-primary"
                          onClick={() => handleRetry(log)}
                          disabled={retryingId === log.id || log.retryCount >= 3}
                        >
                          {retryingId === log.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
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
        </CardContent>
      </Card>
    </div>
  );
}
