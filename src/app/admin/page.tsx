
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Search,
  MoreVertical,
  CheckCircle2,
  Loader2,
  Trash2,
  Smartphone,
  LogOut,
  Plus,
  Zap,
  CheckCircle,
  Ban,
  Activity,
  CreditCard,
  History
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useCollection, useFirestore, useUser, useAuth, useFunctions } from '@/firebase';
import {
  collection,
  doc,
  query,
  limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const SUPER_ADMINS = ['asareg365@gmail.com', 'frankyeb@gmail.com'];

export default function SystemAdminPortal() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const functions = useFunctions();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [managingSmsId, setManagingSmsId] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('500');
  const [platformStats, setPlatformStats] = useState<any>(null);

  const churchesQuery = useMemo(() => {
    const email = user?.email?.toLowerCase().trim();
    if (!user || !email || !SUPER_ADMINS.includes(email)) return null;
    return query(collection(db, 'churches'), limit(100));
  }, [db, user]);

  const { data: rawChurches, loading: collectionLoading } = useCollection(churchesQuery);

  const sortedChurches = useMemo(() => {
    if (!rawChurches) return [];
    return rawChurches
      .filter((c) =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.slug?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => (b.registeredAt?.seconds || 0) - (a.registeredAt?.seconds || 0));
  }, [rawChurches, searchTerm]);

  const activeChurchSms = useMemo(() => 
    sortedChurches.find(c => c.id === managingSmsId), 
  [sortedChurches, managingSmsId]);

  useEffect(() => {
    if (!userLoading && (!user || !SUPER_ADMINS.includes(user.email?.toLowerCase() || ''))) {
      router.push('/admin/login');
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    if (user && SUPER_ADMINS.includes(user.email?.toLowerCase() || '')) {
      const fetchStats = httpsCallable(functions, 'getSystemStats');
      fetchStats()
        .then((res: any) => {
          setPlatformStats(res.data);
        })
        .catch((err) => {
          console.error("System Stats Error:", err);
        });
    }
  }, [user, functions]);

  const handleUpdateStatus = async (churchId: string, status: string) => {
    setIsProcessing(true);
    const updateFn = httpsCallable(functions, 'updateChurchStatus');
    try {
      await updateFn({ churchId, status });
      toast({ title: `Organization ${status.toUpperCase()}`, description: "Status updated in high-integrity ledger." });
    } catch (e: any) {
      toast({ title: "Operation Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTopUp = async () => {
    if (!managingSmsId || !topUpAmount) return;
    setIsProcessing(true);
    const topUpFn = httpsCallable(functions, 'adminTopUpWallet');
    try {
      await topUpFn({ churchId: managingSmsId, amount: parseInt(topUpAmount) });
      toast({ title: "Credits Allocated", description: `${topUpAmount} credits added with transaction audit.` });
      setManagingSmsId(null);
    } catch (e: any) {
      toast({ title: "Top-up Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (userLoading || (user && !SUPER_ADMINS.includes(user.email?.toLowerCase() || ''))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Authenticating System Access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            System Control Center
          </h2>
          <p className="text-muted-foreground text-lg">Platform-wide multi-tenant resource management.</p>
        </div>
        <Button variant="outline" onClick={() => signOut(auth)} className="rounded-xl">
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="glass border-primary/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Total Tenants</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{platformStats?.totalTenants || sortedChurches.length}</div></CardContent>
        </Card>
        <Card className="glass border-accent/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Global Sent</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-accent">{(platformStats?.totalSent || 0).toLocaleString()}</div></CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Credit Pool</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-primary">{(platformStats?.globalCreditPool || 0).toLocaleString()}</div></CardContent>
        </Card>
        <Card className="glass border-destructive/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Global Failures</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-destructive">{(platformStats?.totalFailed || 0).toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-7">
          <div>
            <CardTitle>Organization Directory</CardTitle>
            <CardDescription>Manage tenant lifecycles and source-of-truth wallets.</CardDescription>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search ministries..." className="pl-10 h-11" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ministry</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collectionLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-xs text-muted-foreground">Retrieving organization records...</p>
                  </TableCell>
                </TableRow>
              ) : sortedChurches.map((church) => (
                <TableRow key={church.id}>
                  <TableCell>
                    <div className="font-bold">{church.name}</div>
                    <code className="text-[10px] text-primary">{church.slug}</code>
                  </TableCell>
                  <TableCell><Badge variant="outline">{church.plan || 'Starter'}</Badge></TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "uppercase text-[9px] font-bold px-2 py-0.5",
                      church.sms?.subscriptionStatus === 'active' ? "bg-accent text-white" : 
                      church.sms?.subscriptionStatus === 'suspended' ? "bg-destructive text-white" : 
                      "bg-amber-100 text-amber-700"
                    )}>
                      {church.sms?.subscriptionStatus || 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono font-bold">{(church.sms?.credits || 0).toLocaleString()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setManagingSmsId(church.id)} className="font-bold text-primary">
                          <Zap className="mr-2 h-4 w-4" /> Top-up Wallet
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {church.sms?.subscriptionStatus !== 'active' ? (
                          <DropdownMenuItem onClick={() => handleUpdateStatus(church.id, 'active')}>
                            <CheckCircle className="mr-2 h-4 w-4 text-accent" /> Activate Organization
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleUpdateStatus(church.id, 'suspended')} className="text-destructive">
                            <Ban className="mr-2 h-4 w-4" /> Suspend Service
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => router.push(`/dashboard?impersonate=${church.id}`)}>
                          <Activity className="mr-2 h-4 w-4" /> View Analytics
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!managingSmsId} onOpenChange={(o) => !o && setManagingSmsId(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Source-of-Truth Allocation</DialogTitle>
            <DialogDescription>Adding credits for <strong>{activeChurchSms?.name}</strong>. This action is recorded in the immutable ledger.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="p-4 rounded-xl bg-muted/20 border flex justify-between items-center">
              <span className="text-sm font-medium">Current Balance:</span>
              <span className="text-xl font-bold">{(activeChurchSms?.sms?.credits || 0).toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              <Label>Amount to Add</Label>
              <div className="flex gap-2">
                <Input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} className="h-12 bg-white" />
                <Button className="bg-primary h-12 px-6" onClick={handleTopUp} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagingSmsId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
