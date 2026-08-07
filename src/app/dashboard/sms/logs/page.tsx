'use client';

import { useState, useMemo } from 'react';
import { 
  History, 
  Search,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  MessageSquare
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, limit, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { SMSLog } from '@/services/sms-service';

export default function SMSLogsPage({ currentChurch }: { currentChurch: any }) {
  const db = useFirestore();

  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Uses inherited church context for stability
  const logsRef = useMemo(() => {
    if (!currentChurch?.id || !db) return null;
    return collection(db, 'churches', currentChurch.id, 'smsLogs');
  }, [db, currentChurch?.id]);

  const logsQuery = useMemo(() => {
    if (!logsRef) return null;
    return query(logsRef, orderBy('createdAt', 'desc'), limit(200));
  }, [logsRef]);

  const { data: allLogs, loading: logsLoading } = useCollection<SMSLog>(logsQuery);

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

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  const handleExportCSV = () => {
    if (!filteredLogs.length) return;
    const headers = ['Member', 'Phone', 'Message', 'Type', 'Status', 'Date'];
    const rows = filteredLogs.map(l => [
      l.memberName || 'Guest',
      l.phone,
      `"${l.message.replace(/"/g, '""')}"`,
      l.type,
      l.status,
      l.createdAt?.toDate ? format(l.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : 'N/A'
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `sms_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="glass overflow-hidden shadow-xl border-border">
      <CardHeader className="bg-muted/20 border-b border-border space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 flex-1 w-full">
            <div className="relative flex-1 md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search member or phone..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="pl-10 h-10 rounded-xl bg-white/50"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-32 h-10 rounded-xl bg-white/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-32 h-10 rounded-xl bg-white/50">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="birthday">Birthday</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="reminder">Reminder</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl" onClick={handleExportCSV} disabled={!filteredLogs.length}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/10 text-muted-foreground border-b border-border">
              <tr>
                <th className="p-4 font-bold uppercase tracking-wider text-[10px]"><User className="w-3 h-3 inline mr-1" /> Member</th>
                <th className="p-4 font-bold uppercase tracking-wider text-[10px]"><Phone className="w-3 h-3 inline mr-1" /> Phone</th>
                <th className="p-4 font-bold uppercase tracking-wider text-[10px]"><MessageSquare className="w-3 h-3 inline mr-1" /> Message</th>
                <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Type</th>
                <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="p-4 font-bold uppercase tracking-wider text-[10px] text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/5 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-foreground">{log.memberName || 'Guest Recipient'}</div>
                  </td>
                  <td className="p-4">
                    <code className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">{log.phone}</code>
                  </td>
                  <td className="p-4">
                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-[250px]" title={log.message}>
                      {log.message}
                    </p>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className="capitalize text-[10px] bg-white h-5">
                      {log.type}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        log.status === 'sent' ? 'bg-accent' : 
                        log.status === 'failed' ? 'bg-destructive' : 'bg-amber-400'
                      )} />
                      <span className={cn(
                        "font-medium capitalize text-xs",
                        log.status === 'sent' ? 'text-accent' : 
                        log.status === 'failed' ? 'text-destructive' : 'text-amber-600'
                      )}>
                        {log.status}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-[10px] text-muted-foreground text-right">
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
              {paginatedLogs.length === 0 && !logsLoading && (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <History className="w-12 h-12" />
                      <p>No matching logs found.</p>
                    </div>
                  </td>
                </tr>
              )}
              {logsLoading && (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {Math.min(filteredLogs.length, (page - 1) * pageSize + 1)}-{Math.min(filteredLogs.length, page * pageSize)} of {filteredLogs.length}
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-bold w-12 text-center">
              {page} / {totalPages || 1}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
              disabled={page === totalPages || totalPages === 0}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
