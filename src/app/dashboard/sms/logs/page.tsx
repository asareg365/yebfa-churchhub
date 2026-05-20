'use client';

import { useState, useMemo } from 'react';
import { 
  History, 
  Search,
  Filter,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function SMSLogsPage() {
  const db = useFirestore();
  const { user } = useUser();

  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  const logsQuery = useMemo(() => {
    if (!logsRef) return null;
    return query(logsRef, orderBy('createdAt', 'desc'), limit(100));
  }, [logsRef]);

  const { data: allLogs, loading: logsLoading } = useCollection(logsQuery);

  const filteredLogs = useMemo(() => {
    if (!allLogs) return [];
    return allLogs.filter(log => {
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      const matchesType = typeFilter === 'all' || log.type === typeFilter;
      const matchesSearch = 
        (log.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
         log.phone?.includes(searchTerm));
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [allLogs, statusFilter, typeFilter, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">SMS Logs</h2>
        <p className="text-muted-foreground">Comprehensive history of all communication sent through the platform.</p>
      </div>

      <Card className="glass overflow-hidden shadow-xl border-border">
        <CardHeader className="bg-muted/20 border-b border-border space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <CardTitle className="text-lg">Delivery History</CardTitle>
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
    </div>
  );
}