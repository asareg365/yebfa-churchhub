'use client';

import { useMemo } from 'react';
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
  Smartphone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import Link from 'next/link';

export default function BillingDashboardPage() {
  const db = useFirestore();
  const { user } = useUser();

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

  const sub = currentChurch?.subscription || { plan: 'Basic', smsCredits: 100, smsUsed: 0, status: 'active', renewalDate: 'N/A' };
  const usagePercent = Math.min(100, (sub.smsUsed / sub.smsCredits) * 100);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Billing Overview</h2>
          <p className="text-muted-foreground">Manage your ministry subscription and SMS credits.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/billing/plans">
            <Button className="bg-primary px-6 rounded-xl">
              <Package className="w-4 h-4 mr-2" /> Change Plan
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass md:col-span-2 overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-border">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Current Subscription
                </CardTitle>
                <CardDescription>Plan level: <span className="font-bold text-foreground capitalize">{sub.plan}</span></CardDescription>
              </div>
              <Badge className={cn(
                "h-6 px-3 rounded-full uppercase text-[10px] font-bold",
                sub.status === 'active' ? 'bg-accent text-white' : 'bg-destructive text-white'
              )}>
                {sub.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SMS Credits Used</p>
                    <h3 className="text-3xl font-bold">{sub.smsUsed.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">/ {sub.smsCredits.toLocaleString()}</span></h3>
                  </div>
                  <p className="text-xs font-bold text-primary">{Math.round(usagePercent)}% Used</p>
                </div>
                <Progress value={usagePercent} className="h-2 bg-muted rounded-full overflow-hidden" />
                <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                  <Info className="w-3 h-3" /> Credits reset on {sub.renewalDate}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Renewal Date</p>
                  <p className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    {sub.renewalDate}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-muted/20 border border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Payments</p>
                  <p className="text-sm font-bold flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-accent" />
                    GH₵{sub.totalPayments || 0}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass bg-accent/5 border-accent/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-accent" />
              Manual Renewal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/50 border border-accent/10 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Mobile Money (MoMo)</p>
              <p className="text-2xl font-bold text-accent">0248472474</p>
              <p className="text-[10px] italic text-muted-foreground">Reference: Your Church Name</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Standard and Premium plan updates are currently processed manually. Please contact support with your payment reference for immediate activation.
            </p>
            <Button variant="outline" className="w-full h-10 border-accent/20 text-accent hover:bg-accent/10 rounded-xl font-bold text-xs" onClick={() => window.open('https://wa.me/233248472474')}>
              Verify Payment via WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
            <CardDescription>Log of your subscription payments and credit recharges.</CardDescription>
          </div>
          <Link href="/dashboard/billing/transactions">
            <Button variant="ghost" size="sm" className="text-primary font-bold text-xs">View All History</Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/10 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Reference</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Amount</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px]">Method</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-[10px] text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions?.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-mono text-xs">{tx.reference}</td>
                    <td className="p-4 font-bold text-accent">GH₵{tx.amount}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={cn(
                        "text-[10px] rounded-full uppercase h-5",
                        tx.status === 'success' ? 'text-accent border-accent/20' : 'text-muted-foreground'
                      )}>
                        {tx.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-xs">{tx.provider}</td>
                    <td className="p-4 text-right text-[10px] text-muted-foreground">
                      {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                    </td>
                  </tr>
                ))}
                {transactions?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground italic opacity-50">
                      No transaction history found.
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
