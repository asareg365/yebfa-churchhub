'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Search,
  MoreVertical,
  Loader2,
  LogOut,
  Plus,
  Zap,
  CheckCircle,
  Ban,
  Activity,
  CreditCard,
  TrendingUp,
  DollarSign,
  Users,
  Info,
  Target,
  AlertTriangle,
  Pencil,
  RefreshCcw
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser, useAuth, useFunctions } from '@/firebase';
import { httpsCallable } from 'firebase/functions';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

const SUPER_ADMINS = ['asareg365@gmail.com', 'frankyeb@gmail.com'];

export default function SystemAdminPortal() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const functions = useFunctions();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [managingSmsId, setManagingSmsId] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [topUpAmount, setTopUpAmount] = useState('500');
  const [platformStats, setPlatformStats] = useState<any>(null);
  const [statsError, setStatsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadStats = async () => {
    if (!auth.currentUser) return;
    
    setIsRefreshing(true);
    setStatsError(false);
    setErrorMessage('');
    const fetchStats = httpsCallable(functions, 'getSystemStats');
    try {
      const res: any = await fetchStats();
      if (res.data) {
        setPlatformStats(res.data);
      } else {
        throw new Error("Empty response from platform engine.");
      }
    } catch (err: any) {
      console.error("System Stats Sync Error:", err);
      setStatsError(true);
      setErrorMessage(err.message || "Could not fetch platform data.");
      toast({ 
        title: "Stats Sync Failed", 
        description: err.message || "Internal system error during statistics aggregation.", 
        variant: "destructive" 
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!userLoading && (!user || !SUPER_ADMINS.includes(user.email?.toLowerCase() || ''))) {
      router.push('/admin/login');
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    if (user && auth.currentUser && SUPER_ADMINS.includes(user.email?.toLowerCase() || '')) {
      loadStats();
    }
  }, [user, auth.currentUser]);

  const filteredChurches = useMemo(() => {
    if (!platformStats?.churches || !Array.isArray(platformStats.churches)) return [];
    return platformStats.churches.filter((c: any) =>
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [platformStats, searchTerm]);

  const activeChurchSms = useMemo(() => 
    (Array.isArray(platformStats?.churches) ? platformStats.churches : []).find((c: any) => c.id === managingSmsId), 
  [platformStats, managingSmsId]);

  const handleUpdateStatus = async (churchId: string, status: string) => {
    setIsProcessing(true);
    const updateFn = httpsCallable(functions, 'updateChurchStatus');
    try {
      await updateFn({ churchId, status });
      toast({ title: `Organization ${status.toUpperCase()}`, description: "Status updated in secure ledger." });
      await loadStats(); 
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
      toast({ title: "Credits Allocated", description: `${topUpAmount} SMS credits added successfully.` });
      setManagingSmsId(null);
      await loadStats(); 
    } catch (e: any) {
      toast({ title: "Top-up Failed", description: e.message || "Internal error.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateOrg = async () => {
    if (!editingOrg) return;
    setIsProcessing(true);
    const updateFn = httpsCallable(functions, 'updateOrganization');
    try {
      const adminEmailsArr = typeof editingOrg.adminEmails === 'string' 
        ? editingOrg.adminEmails.split(',').map((e: string) => e.trim().toLowerCase())
        : editingOrg.adminEmails;

      await updateFn({
        churchId: editingOrg.id,
        name: editingOrg.name,
        slug: editingOrg.slug,
        adminEmails: adminEmailsArr,
        plan: editingOrg.plan
      });
      toast({ title: "Organization Updated", description: "Details have been synchronized across nodes." });
      setEditingOrg(null);
      await loadStats();
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (userLoading || (user && !SUPER_ADMINS.includes(user.email?.toLowerCase() || ''))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            System Control Center
          </h2>
          <p className="text-muted-foreground text-lg">Global multi-tenant infrastructure management.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" size="icon" onClick={loadStats} className={cn("rounded-xl transition-all", isRefreshing && "animate-spin")} disabled={isRefreshing}>
             <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => signOut(auth)} className="rounded-xl">
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </div>

      {statsError && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 animate-in fade-in zoom-in-95">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-bold ml-2">Sync Error</AlertTitle>
          <AlertDescription className="ml-2 text-sm">
            {errorMessage || "The platform stats engine returned an error. Some organization data may be stale."}
            <Button variant="link" size="sm" onClick={loadStats} className="text-destructive font-bold underline ml-4 p-0 h-auto">Retry Sync</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="glass border-primary/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Users className="w-3 h-3"/> Total Tenants</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{platformStats?.totalTenants ?? (isRefreshing ? "..." : "0")}</div>
            <p className="text-[10px] text-muted-foreground mt-1">{platformStats?.activeTenants || 0} Active Organizations</p>
          </CardContent>
        </Card>
        <Card className="glass border-accent/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><DollarSign className="w-3 h-3"/> Platform Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">GH₵{(platformStats?.totalRevenue || 0).toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1">All-time GH₵ processed</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><TrendingUp className="w-3 h-3"/> Global Sent</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{(platformStats?.totalSent || 0).toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total platform dispatches</p>
          </CardContent>
        </Card>
        <Card className="glass border-destructive/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><AlertTriangle className="w-3 h-3"/> Global Failures</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{(platformStats?.totalFailed || 0).toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1">System-wide errors</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass md:col-span-2">
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
                  <TableHead>Balance (Credits)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRefreshing && !platformStats ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell>
                  </TableRow>
                ) : filteredChurches.map((church: any) => (
                  <TableRow key={church.id}>
                    <TableCell><div className="font-bold">{church.name}</div><code className="text-[10px] text-primary">{church.slug}</code></TableCell>
                    <TableCell><Badge variant="outline">{church.plan || 'Starter'}</Badge></TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "uppercase text-[9px] font-bold px-2 py-0.5",
                        church.sms?.subscriptionStatus === 'active' ? "bg-accent text-white" : 
                        church.sms?.subscriptionStatus === 'suspended' ? "bg-destructive text-white" : "bg-amber-100 text-amber-700"
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
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setEditingOrg(church)} className="font-bold"><Pencil className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setManagingSmsId(church.id)} className="font-bold text-primary"><Zap className="mr-2 h-4 w-4" /> Top-up Wallet</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {church.sms?.subscriptionStatus !== 'active' ? (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(church.id, 'active')}><CheckCircle className="mr-2 h-4 w-4 text-accent" /> Activate Org</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(church.id, 'suspended')} className="text-destructive"><Ban className="mr-2 h-4 w-4" /> Suspend Service</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredChurches.length === 0 && !isRefreshing && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No organizations found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="glass h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Top Active Tenants</CardTitle>
            <CardDescription className="text-xs">Based on total SMS dispatches.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Array.isArray(platformStats?.topSpenders) ? platformStats.topSpenders : []).map((spener: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border group hover:border-primary/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">#{i + 1}</div>
                  <div><p className="text-xs font-bold truncate max-w-[120px]">{spener.name}</p><p className="text-[10px] text-muted-foreground">{(spener.sent || 0).toLocaleString()} Msgs</p></div>
                </div>
                <div className="text-right"><p className="text-[10px] font-bold text-accent">{(spener.balance || 0).toLocaleString()} Cr</p></div>
              </div>
            ))}
            {!platformStats && !statsError && <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
            {statsError && <div className="py-8 text-center text-xs text-destructive flex flex-col items-center gap-2">
               <AlertTriangle className="h-4 w-4" />
               Stats unavailable. <Button variant="link" size="sm" onClick={loadStats}>Retry</Button>
            </div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!managingSmsId} onOpenChange={(o) => !o && setManagingSmsId(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Wallet Credit Allocation</DialogTitle>
            <DialogDescription>Adding credits for <strong>{activeChurchSms?.name}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="p-4 rounded-xl bg-muted/20 border flex justify-between items-center">
              <span className="text-sm font-medium">Current Balance:</span>
              <span className="text-xl font-bold">{(activeChurchSms?.sms?.credits || 0).toLocaleString()} Credits</span>
            </div>
            <div className="space-y-2">
              <Label>SMS Credits to Add</Label>
              <div className="flex gap-2">
                <Input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} className="h-12 bg-white" />
                <Button className="bg-primary h-12 px-6" onClick={handleTopUp} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingOrg} onOpenChange={(o) => !o && setEditingOrg(null)}>
        <DialogContent className="glass max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Organization Profile</DialogTitle>
            <DialogDescription>Update platform-level settings for this ministry.</DialogDescription>
          </DialogHeader>
          {editingOrg && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ministry Name</Label>
                  <Input value={editingOrg.name} onChange={(e) => setEditingOrg({...editingOrg, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Tenant Slug (System ID)</Label>
                  <Input value={editingOrg.slug} onChange={(e) => setEditingOrg({...editingOrg, slug: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Authorized Admin Emails (Comma separated)</Label>
                <Textarea 
                   value={Array.isArray(editingOrg.adminEmails) ? editingOrg.adminEmails.join(', ') : editingOrg.adminEmails} 
                   onChange={(e) => setEditingOrg({...editingOrg, adminEmails: e.target.value})} 
                   className="h-24 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Current Plan</Label>
                <div className="flex gap-2">
                  {['Basic', 'Standard', 'Premium'].map(p => (
                    <Button 
                      key={p} 
                      variant={editingOrg.plan === p ? 'default' : 'outline'} 
                      className="flex-1"
                      onClick={() => setEditingOrg({...editingOrg, plan: p})}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(null)}>Cancel</Button>
            <Button onClick={handleUpdateOrg} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Save All Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}