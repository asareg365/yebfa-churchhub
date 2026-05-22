'use client';

import { useMemo, useState } from 'react';
import { 
  FileText, 
  Download, 
  BarChart3, 
  Loader2, 
  ArrowLeft, 
  Info, 
  Calendar, 
  Plus, 
  CheckCircle2, 
  Clock,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, limit, addDoc, serverTimestamp, orderBy, deleteDoc, doc } from 'firebase/firestore';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function BillingUsageReportsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reportType, setReportType] = useState('usage');
  const [period, setPeriod] = useState('30');

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const reportsRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, 'churches', currentChurch.id, 'billingReports');
  }, [db, currentChurch?.id]);

  const { data: reports, loading: reportsLoading } = useCollection(
    reportsRef ? query(reportsRef, orderBy('createdAt', 'desc')) : null
  );

  const sub = currentChurch?.subscription || { plan: 'Basic', smsCredits: 100, smsUsed: 0 };
  const usagePercent = Math.min(100, ((sub.smsUsed || 0) / (sub.smsCredits || 1)) * 100);

  const handleGenerateReport = async () => {
    if (!reportsRef) return;
    setIsGenerating(true);

    try {
      const typeLabel = reportType === 'usage' ? 'Usage Summary' : 'Financial Audit';
      const periodLabel = period === '30' ? 'Last 30 Days' : 'Last 90 Days';
      
      await addDoc(reportsRef, {
        title: `${typeLabel} - ${periodLabel}`,
        period: periodLabel,
        type: 'PDF',
        category: reportType === 'usage' ? 'Consumption' : 'Financial',
        status: 'completed',
        size: '1.2 MB',
        statementId: `STMT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        createdAt: serverTimestamp(),
        generatedBy: user?.email
      });

      toast({ 
        title: "Report Generated", 
        description: "Your consumption statement is now available for download." 
      });
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({ 
        title: "Generation Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!reportsRef) return;
    try {
      await deleteDoc(doc(reportsRef, reportId));
      toast({ title: "Report archived" });
    } catch (e) {}
  };

  if (churchLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Usage Reports</h2>
          <p className="text-muted-foreground">Managing your ministry's digital resource statements for {currentChurch?.name}.</p>
        </div>
        <Link href="/dashboard/billing">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Overview
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Generated Statements
              </CardTitle>
              <CardDescription>Access and download your archived consumption reports.</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary rounded-xl" disabled={!currentChurch}>
                  <Plus className="w-4 h-4 mr-2" /> New Report
                </Button>
              </DialogTrigger>
              <DialogContent className="glass">
                <DialogHeader>
                  <DialogTitle>Generate Custom Statement</DialogTitle>
                  <DialogDescription>Select the parameters for your new consumption report.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Report Category</Label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger className="bg-muted/20">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usage">SMS Usage Summary</SelectItem>
                        <SelectItem value="financial">Financial Credit Audit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Time Period</Label>
                    <Select value={period} onValueChange={setPeriod}>
                      <SelectTrigger className="bg-muted/20">
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">Last 30 Days</SelectItem>
                        <SelectItem value="90">Last 90 Days</SelectItem>
                        <SelectItem value="current">Current Billing Cycle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleGenerateReport} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BarChart3 className="w-4 h-4 mr-2" />}
                    Generate Statement
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-3">
            {reportsLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
            ) : reports && reports.length > 0 ? (
              reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-border hover:border-primary/20 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{report.title}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        {report.createdAt?.toDate ? format(report.createdAt.toDate(), 'MMM d, yyyy') : 'Recently'} • {report.size} • {report.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 rounded-xl">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteReport(report.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-24 text-center space-y-4 opacity-40">
                <FileText className="w-16 h-16 mx-auto mb-4" />
                <p className="text-sm font-medium">No reports generated yet.</p>
                <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">Click "New Report" to build your first usage statement.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Live Allocation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  <span>SMS Credits</span>
                  <span>{Math.round(usagePercent)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000" 
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-4">
                   <p className="text-[10px] text-muted-foreground italic">Current Plan: {sub.plan}</p>
                   <Badge variant="secondary" className="text-[9px] bg-white">{sub.smsUsed?.toLocaleString()} / {sub.smsCredits?.toLocaleString()}</Badge>
                </div>
              </div>
              <Button 
                className="w-full bg-primary h-11 rounded-xl text-xs font-bold shadow-lg shadow-primary/20"
                onClick={() => setIsDialogOpen(true)}
              >
                Quick Generate
              </Button>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                Billing Cycle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/10">
                <p className="text-xs font-medium text-muted-foreground mb-1">Next Statement</p>
                <p className="text-lg font-bold text-accent">{currentChurch?.subscription?.renewalDate || '1st of Next Month'}</p>
              </div>
              <div className="mt-4 p-4 rounded-xl bg-muted/20 border border-border space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <CheckCircle2 className="w-3 h-3 text-accent" />
                  Auto-Archiving Active
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Statements are automatically generated and archived on the 1st of every month for your records.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
