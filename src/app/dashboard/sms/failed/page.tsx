'use client';

import { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Search,
  Loader2,
  RefreshCcw
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { sendAndLogSMS } from '@/services/sms-service';
import { useToast } from '@/hooks/use-toast';

export default function FailedMessagesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const logsRef = useMemo(() => currentChurch?.id ? collection(db, 'churches', currentChurch.id, 'smsLogs') : null, [db, currentChurch?.id]);
  const failedQuery = useMemo(() => {
    if (!logsRef) return null;
    return query(logsRef, where('status', '==', 'failed'), orderBy('createdAt', 'desc'));
  }, [logsRef]);

  const { data: failedLogs, loading } = useCollection(failedQuery);

  const filteredLogs = useMemo(() => {
    if (!failedLogs) return [];
    return failedLogs.filter(log => 
      log.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.phone?.includes(searchTerm)
    );
  }, [failedLogs, searchTerm]);

  const handleRetry = async (log: any) => {
    if (!currentChurch?.id) return;
    setRetryingId(log.id);
    try {
      const outcome = await sendAndLogSMS(db, currentChurch.id, {
        phone: log.phone,
        message: log.message,
        type: log.type,
        memberName: log.memberName,
        memberId: log.memberId
      });
      if (outcome.success) {
        toast({ title: 'Retry successful', description: 'Message has been sent.' });
      } else {
        toast({ title: 'Retry failed', description: outcome.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Failed Messages</h2>
        <p className="text-muted-foreground">Monitor and retry messages that failed to deliver.</p>
      </div>

      <Card className="glass overflow-hidden shadow-xl border-border">
        <CardHeader className="bg-destructive/5 border-b border-border space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delivery Failures
            </CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search failed records..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 rounded-xl"
              />
            </div>
          </div>
        </CardHeader>
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/10 text-muted-foreground">
                <tr>
                  <th className="p-4 font-bold uppercase tracking-wider text-xs">Recipient</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-xs">Message Preview</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-xs">Error</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs?.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/5 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{log.memberName || 'Guest'}</div>
                      <div className="text-xs text-muted-foreground">{log.phone}</div>
                    </td>
                    <td className="p-4">
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{log.message}</p>
                    </td>
                    <td className="p-4">
                      <Badge variant="destructive" className="bg-destructive/10 text-destructive text-[10px] border-0">
                        {log.error || 'Provider Error'}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="rounded-lg h-8"
                        onClick={() => handleRetry(log)}
                        disabled={retryingId === log.id}
                      >
                        {retryingId === log.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCcw className="w-3 h-3 mr-1" />
                        )}
                        Retry
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredLogs?.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="p-20 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <AlertTriangle className="w-12 h-12" />
                        <p>No failed messages found.</p>
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
