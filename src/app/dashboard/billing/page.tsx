'use client';

import { useMemo, useState } from 'react';
import { 
  Wallet, 
  Package, 
  History, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Loader2,
  Calendar,
  Smartphone,
  FileText,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Sub-components
import PlansPage from './plans/page';
import ReportsPage from '../reports/page';

export default function BillingCenterHub() {
  const db = useFirestore();
  const { user } = useUser();
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

  const { data: transactions } = useCollection(transactionsRef ? query(transactionsRef, orderBy('createdAt', 'desc'), limit(20)) : null);

  const sub = currentChurch?.subscription || { plan: 'Basic', smsCredits: 100, smsUsed: 0, status: 'active', renewalDate: 'N/A' };
  const usagePercent = Math.min(100, ((sub.smsUsed || 0) / (sub.smsCredits || 1)) * 100);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Billing Center</h2>
          <p className="text-muted-foreground">Managing subscriptions and enterprise credits for {currentChurch?.name}.</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-primary rounded-xl" onClick={() => setActiveTab('plans')}>
            <Package className="w-4 h-4 mr-2" /> Upgrade Plan
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="overview" className="rounded-xl px-6"><Wallet className="w-4 h-4 mr-2" />Overview</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl px-6"><Package className="w-4 h-4 mr-2" />Plans</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-xl px-6"><History className="w-4 h-4 mr-2" />Transactions</TabsTrigger>
          <TabsTrigger value="usage" className="rounded-xl px-6"><FileText className="w-4 h-4 mr-2" />Usage Reports</TabsTrigger>
        </TabsList>

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
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SMS Credits Used</p>
                        <h3 className="text-3xl font-bold">{(sub.smsUsed || 0).toLocaleString()} <span className="text-sm font-medium text-muted-foreground">/ {(sub.smsCredits || 0).toLocaleString()}</span></h3>
                      </div>
                      <p className="text-xs font-bold text-primary">{Math.round(usagePercent)}% Used</p>
                    </div>
                    <Progress value={usagePercent} className="h-2 bg-muted rounded-full overflow-hidden" />
                    <p className="text-[10px] text-muted-foreground italic flex items-center gap-1"><Info className="w-3 h-3" /> Next billing cycle: {sub.renewalDate}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-muted/20 border border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Renewal Date</p>
                      <p className="text-sm font-bold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />{sub.renewalDate}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/20 border border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Lifetime Spend</p>
                      <p className="text-sm font-bold flex items-center gap-2"><CreditCard className="w-4 h-4 text-accent" />GH₵{(sub.smsUsed || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass bg-accent/5 border-accent/20">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Smartphone className="w-5 h-5 text-accent" />Manual Top-up</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/50 border border-accent/10 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">MoMo Pay</p>
                  <p className="text-2xl font-bold text-accent">0248472474</p>
                  <p className="text-[10px] italic text-muted-foreground">Reference: Your Church Slug</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Payments are typically applied within 1 hour. Contact support for instant activation.</p>
                <Button variant="outline" className="w-full border-accent/20 text-accent font-bold" onClick={() => window.open('https://wa.me/233248472474')}>WhatsApp Verification</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plans"><PlansPage /></TabsContent>
        <TabsContent value="transactions">
          <Card className="glass overflow-hidden">
            <CardHeader><CardTitle className="text-lg">Transaction History</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/10 text-muted-foreground border-b border-border">
                    <tr><th className="p-4 font-bold text-[10px]">Reference</th><th className="p-4 font-bold text-[10px]">Amount</th><th className="p-4 font-bold text-[10px]">Status</th><th className="p-4 font-bold text-[10px]">Provider</th><th className="p-4 font-bold text-[10px] text-right">Date</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions?.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/5">
                        <td className="p-4 font-mono text-xs">{tx.reference}</td>
                        <td className="p-4 font-bold text-accent">GH₵{tx.amount}</td>
                        <td className="p-4"><Badge variant="outline" className={cn("text-[10px] uppercase", tx.status === 'success' ? 'text-accent' : 'text-muted-foreground')}>{tx.status}</Badge></td>
                        <td className="p-4 text-xs">{tx.provider}</td>
                        <td className="p-4 text-right text-[10px] text-muted-foreground">{tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="usage"><ReportsPage /></TabsContent>
      </Tabs>
    </div>
  );
}