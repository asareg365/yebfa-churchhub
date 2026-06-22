'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Wallet, 
  Package, 
  History, 
  CreditCard, 
  Smartphone,
  FileText,
  Info,
  Calendar,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Sub-components
import PlansPage from './plans/page';
import BillingTransactionsPage from './transactions/page';
import BillingUsageReportsPage from './reports/page';

export default function BillingCenterHub() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState('overview');

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const transactionsRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, 'churches', currentChurch.id, 'transactions');
  }, [db, currentChurch?.id]);

  const { data: transactions } = useCollection(transactionsRef ? query(transactionsRef, orderBy('createdAt', 'desc'), limit(5)) : null);

  const sub = useMemo(() => ({
    plan: currentChurch?.plan || 'Basic',
    smsCredits: currentChurch?.sms?.credits || 0,
    smsUsed: currentChurch?.sms?.stats?.sent || 0,
    status: currentChurch?.sms?.subscriptionStatus || 'active',
    renewalDate: currentChurch?.subscription?.renewalDate || '1st of Month'
  }), [currentChurch]);

  const totalAllocation = useMemo(() => {
    if (sub.plan === 'Premium') return 5000;
    if (sub.plan === 'Standard') return 1000;
    return 100;
  }, [sub.plan]);

  const usagePercent = Math.min(100, ((sub.smsUsed) / totalAllocation) * 100);

  if (churchLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Billing Center</h2>
          <p className="text-muted-foreground">Managing subscriptions and enterprise credits for {currentChurch?.name}.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button className="flex-1 md:flex-none bg-primary rounded-xl" onClick={() => setActiveTab('plans')}>
            <Package className="w-4 h-4 mr-2" /> Upgrade Plan
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="w-full overflow-x-auto hide-scrollbar pb-1">
          <TabsList className="glass border-white/10 p-1 rounded-2xl w-fit min-w-full inline-flex md:w-auto">
            <TabsTrigger value="overview" className="rounded-xl px-6 shrink-0"><Wallet className="w-4 h-4 mr-2" />Overview</TabsTrigger>
            <TabsTrigger value="plans" className="rounded-xl px-6 shrink-0"><Package className="w-4 h-4 mr-2" />Plans</TabsTrigger>
            <TabsTrigger value="transactions" className="rounded-xl px-6 shrink-0"><History className="w-4 h-4 mr-2" />Transactions</TabsTrigger>
            <TabsTrigger value="usage" className="rounded-xl px-6 shrink-0"><FileText className="w-4 h-4 mr-2" />Usage Reports</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="glass md:col-span-2 overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-border">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5 text-primary" />Current Subscription</CardTitle>
                    <CardDescription>Plan level: <span className="font-bold text-foreground capitalize">{sub.plan}</span></CardDescription>
                  </div>
                  <Badge className={cn("h-6 px-3 rounded-full uppercase text-[10px] font-bold", sub.status === 'active' ? 'bg-accent text-white' : 'bg-destructive text-white')}>{sub.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Available SMS Balance</p>
                        <h3 className="text-3xl font-bold">{sub.smsCredits.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">Credits</span></h3>
                      </div>
                      <p className="text-xs font-bold text-primary">{Math.round(usagePercent)}% Used</p>
                    </div>
                    <Progress value={usagePercent} className="h-2 bg-muted rounded-full overflow-hidden" />
                    <p className="text-[10px] text-muted-foreground italic flex items-center gap-1"><Info className="w-3 h-3" /> Monthly allocation reset: {sub.renewalDate}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-muted/20 border border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Renewal Date</p>
                      <p className="text-sm font-bold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />{sub.renewalDate}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/20 border border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Plan Limit</p>
                      <p className="text-sm font-bold flex items-center gap-2"><CreditCard className="w-4 h-4 text-accent" />{totalAllocation.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-border">
                   <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Recent Activity</h4>
                      <Button variant="link" className="text-xs text-primary font-bold" onClick={() => setActiveTab('transactions')}>View All</Button>
                   </div>
                   <div className="space-y-2">
                      {transactions?.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border text-xs">
                          <div className="font-mono">{tx.reference}</div>
                          <div className="font-bold text-accent">GH₵{tx.amount}</div>
                          <Badge variant="outline" className="text-[9px] uppercase">{tx.status}</Badge>
                        </div>
                      ))}
                      {(!transactions || transactions.length === 0) && (
                        <p className="text-xs text-muted-foreground italic text-center py-4">No recent activity.</p>
                      )}
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass bg-accent/5 border-accent/20 h-fit">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Smartphone className="w-5 h-5 text-accent" />Manual Top-up</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/50 border border-accent/10 space-y-2 text-center">
                  <p className="text-xs font-medium text-muted-foreground">MoMo Pay</p>
                  <p className="text-2xl font-bold text-accent">0248472474</p>
                  <p className="text-[10px] italic text-muted-foreground">Reference: {currentChurch?.slug}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Payments are typically applied within 1 hour. Contact support for instant activation.</p>
                <Button variant="outline" className="w-full border-accent/20 text-accent font-bold rounded-xl" onClick={() => window.open('https://wa.me/233248472474')}>WhatsApp Verification</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plans"><PlansPage /></TabsContent>
        <TabsContent value="transactions"><BillingTransactionsPage /></TabsContent>
        <TabsContent value="usage"><BillingUsageReportsPage /></TabsContent>
      </Tabs>
    </div>
  );
}