'use client';

import { useMemo } from 'react';
import { History, CreditCard, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function BillingTransactionsPage() {
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

  const { data: transactions, loading: txLoading } = useCollection(transactionsRef ? query(transactionsRef, orderBy('createdAt', 'desc'), limit(50)) : null);

  if (churchLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Transaction History</h2>
          <p className="text-muted-foreground">Audit trail of all payments and credit top-ups for {currentChurch?.name}.</p>
        </div>
        <Link href="/dashboard/billing">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Overview
          </Button>
        </Link>
      </div>

      <Card className="glass overflow-hidden shadow-xl border-border">
        <CardHeader className="bg-muted/20 border-b border-border">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Payment Records
          </CardTitle>
          <CardDescription>Enterprise billing history and MoMo verification logs.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/10 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-widest">Reference</th>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-widest">Amount</th>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-widest">Status</th>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-widest">Provider</th>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-widest text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions?.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-mono text-xs font-bold">{tx.reference}</td>
                    <td className="p-4 font-bold text-accent">GH₵{tx.amount?.toLocaleString()}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={cn(
                        "text-[10px] uppercase px-2 py-0.5 rounded-full",
                        tx.status === 'success' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-muted text-muted-foreground'
                      )}>
                        {tx.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-xs font-medium">{tx.provider}</td>
                    <td className="p-4 text-right text-[10px] text-muted-foreground font-bold">
                      {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'MMM d, yyyy HH:mm') : 'Processing...'}
                    </td>
                  </tr>
                ))}
                {!txLoading && (!transactions || transactions.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <CreditCard className="w-12 h-12 mb-2" />
                        <p className="text-sm font-medium">No transactions found for this account.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {txLoading && (
                   <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
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
