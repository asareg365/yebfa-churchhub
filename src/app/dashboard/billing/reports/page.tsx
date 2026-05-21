'use client';

import { useMemo } from 'react';
import { FileText, Download, BarChart3, Loader2, ArrowLeft, Info, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function BillingUsageReportsPage() {
  const db = useFirestore();
  const { user } = useUser();

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const sub = currentChurch?.subscription || { plan: 'Basic', smsCredits: 100, smsUsed: 0 };

  if (churchLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const mockReports = [
    { title: "Monthly Usage Summary", period: "Current Month", type: "PDF", category: "Usage" },
    { title: "SMS Consumption Audit", period: "Last 30 Days", type: "CSV", category: "Audit" },
    { title: "Financial Year Statement", period: "FY 2024", type: "Excel", category: "Finance" }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Usage Reports</h2>
          <p className="text-muted-foreground">Downloadable insights into your ministry's digital resource consumption.</p>
        </div>
        <Link href="/dashboard/billing">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Overview
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Generated Statements
            </CardTitle>
            <CardDescription>Access your archived billing and consumption reports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockReports.map((report, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-border hover:border-primary/20 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{report.title}</p>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{report.period} • {report.type}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 rounded-xl">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            ))}
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
                  <span>{Math.round(((sub.smsUsed || 0) / (sub.smsCredits || 1)) * 100)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000" 
                    style={{ width: `${Math.min(100, ((sub.smsUsed || 0) / (sub.smsCredits || 1)) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground italic">Current Plan: {sub.plan}</p>
              </div>
              <Button className="w-full bg-primary h-11 rounded-xl text-xs font-bold">Generate Custom Report</Button>
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
                <p className="text-xs font-medium text-muted-foreground mb-1">Next Renewal</p>
                <p className="text-lg font-bold text-accent">{currentChurch?.subscription?.renewalDate || 'Pending'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
