'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Search,
  MoreVertical,
  Loader2,
  LogOut,
  Plus,
  Zap,
  CheckCircle2,
  Ban,
  TrendingUp,
  Coins,
  Users,
  AlertTriangle,
  Pencil,
  RefreshCcw,
  CreditCard,
  Trash2,
  RotateCcw,
  Archive,
  Info
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
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, auth, functions } from '@/firebase';
import { httpsCallable } from 'firebase/functions';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const SUPER_ADMINS = ['asareg365@gmail.com', 'frankyeb@gmail.com'];

export default function SystemAdminPortal() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [managingSmsId, setManagingSmsId] = useState<string | null>(null);
  const [ministryToDelete, setMinistryToDelete] = useState<any>(null);
  const [ministryToPurge, setMinistryToPurge] = useState<any>(null);
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [topUpAmount, setTopUpAmount] = useState('500');
  const [platformStats, setPlatformStats] = useState<any>(null);
  const [statsError, setStatsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadStats = useCallback(async () => {
    if (!user || !functions) return;
    
    setIsRefreshing(true);
    setStatsError(false);
    
    try {
      await user.getIdToken(true);
      const fetchStats = httpsCallable(functions, 'getSystemStats');
      const res: any = await fetchStats();
      
      if (res.data && res.data.success) {
        setPlatformStats(res.data);
      } else {
        throw new Error(res.data?.error || "Empty response from platform engine.");
      }
    } catch (err: any) {
      console.error("System Stats Sync Error:", err);
      setStatsError(true);
      const detail = err.message || "Could not fetch platform data.";
      setErrorMessage(detail);
      toast({ title: "Stats Sync Failed", description: detail, variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (mounted && !userLoading && (!user || !SUPER_ADMINS.includes(user.email?.toLowerCase() || ''))) {
      router.replace('/admin/login');
    }
  }, [user, userLoading, router, mounted]);

  useEffect(() => {
    if (user && SUPER_ADMINS.includes(user.email?.toLowerCase() || '')) {
      loadStats();
    }
  }, [user, loadStats]);

  const activeMinistries = useMemo(() => {
    const list = platformStats?.churches || [];
    return list.filter((c: any) => c.deletionStatus !== 'DELETED' && (
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug?.toLowerCase().includes(searchTerm.toLowerCase())
    ));
  }, [platformStats, searchTerm]);

  const deletedMinistries = useMemo(() => {
    const list = platformStats?.churches || [];
    return list.filter((c: any) => c.deletionStatus === 'DELETED' && (
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug?.toLowerCase().includes(searchTerm.toLowerCase())
    ));
  }, [platformStats, searchTerm]);

  const activeChurchSms = useMemo(() => {
    const list = platformStats?.churches || [];
    return list.find((c: any) => c.id === managingSmsId);
  }, [platformStats, managingSmsId]);

  const handleUpdateStatus = async (churchId: string, status: string) => {
    if (!functions) {
      toast({ title: "Service Error", description: "Cloud Functions are currently unavailable.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    const updateFn = httpsCallable(functions, 'updateChurchStatus');
    try {
      await updateFn({ churchId, status });
      toast({ title: `Organization ${status.toUpperCase()}`, description: "Status updated in secure ledger." });
      await loadStats(); 
    } catch (e: any) {
      console.log(e);
      toast({ title: "Operation Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveOrg = async () => {
    if (!editingOrg) return;
    if (!functions) {
      toast({ title: "Service Error", description: "Cloud Functions are currently unavailable.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    const updateFn = httpsCallable(functions, 'updateOrganization');
    try {
      await updateFn({ 
        churchId: editingOrg.id, 
        name: editingOrg.name, 
        slug: editingOrg.slug, 
        plan: editingOrg.plan 
      });
      toast({ title: "Organization Updated", description: `Plan synchronized to ${editingOrg.plan}.` });
      setEditingOrg(null);
      await loadStats(); 
    } catch (e: any) {
      console.log(e);
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!ministryToDelete) return;
    if (!functions) {
      toast({ title: "Service Error", description: "Cloud Functions are currently unavailable.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const deleteFn = httpsCallable(functions, 'deleteMinistry');
      await deleteFn({ churchId: ministryToDelete.id });
      toast({ title: "Ministry Deleted", description: "Organization moved to Recycle Bin." });
      setMinistryToDelete(null);
      await loadStats();
    } catch (e: any) {
      console.log(e);
      const msg = e.message || "Deletion Failed";
      toast({ title: "Action Blocked", description: msg, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async (churchId: string) => {
    if (!functions) {
      toast({ title: "Service Error", description: "Cloud Functions are currently unavailable.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const restoreFn = httpsCallable(functions, 'restoreMinistry');
      await restoreFn({ churchId });
      toast({ title: "Ministry Restored", description: "Organization returned to active directory." });
      await loadStats();
    } catch (e: any) {
      console.log(e);
      toast({ title: "Restore Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentPurge = async () => {
    if (!ministryToPurge || !user) return;
    if (!functions) {
      toast({ title: "Service Error", description: "Cloud Functions are currently unavailable.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      await user.getIdToken(true);
      const purgeFn = httpsCallable(functions, 'hardPurgeMinistry', { timeout: 540000 });
      const res: any = await purgeFn({ churchId: ministryToPurge.id });
      if (res.data?.success) {
        toast({ title: "Permanent Purge Complete", description: "All data has been wiped from the system." });
        setMinistryToPurge(null);
        await loadStats();
      } else {
        throw new Error(res.data?.error || "Purge execution failed on server.");
      }
    } catch (e: any) {
      console.log(e);
      const detail = e.details || e.message || "Deep purge failed.";
      toast({ title: "Purge Error", description: detail, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTopUp = async () => {
    if (!user || !managingSmsId) return;
    if (!functions) {
      toast({ title: "Service Error", description: "Cloud Functions are currently unavailable.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const callable = httpsCallable(functions, "adminTopUpWallet");
      await callable({ churchId: managingSmsId, amount: Number(topUpAmount) });
      toast({ title: "Credits Added", description: `${topUpAmount} SMS credits added.` });
      setManagingSmsId(null);
      await loadStats();
    } catch (error: any) {
      console.log(error);
      toast({ title: "Top-up Failed", description: error?.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !SUPER_ADMINS.includes(user.email?.toLowerCase() || '')) {
    return null;
  }

  const TableSkeleton = () => (
    <div className="p-8 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-1 text-foreground flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            System Control Center
          </h2>
          <p className="text-muted-foreground text-lg">Global multi-tenant infrastructure management.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" size="icon" onClick={loadStats} className={cn("rounded-xl transition-all", isRefreshing && "animate-spin")} disabled={isRefreshing}><RefreshCcw className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => signOut(auth)} className="rounded-xl"><LogOut className="mr-2 h-4 w-4" /> Logout</Button>
        </div>
      </div>

      {statsError && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-bold ml-2">Sync Error</AlertTitle>
          <AlertDescription className="ml-2 text-sm">{errorMessage} <Button variant="link" size="sm" onClick={loadStats} className="text-destructive font-bold underline p-0 h-auto">Retry Sync</Button></AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="glass border-primary/20"><CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Users className="w-3 h-3"/> Total Tenants</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{(platformStats?.totalTenants || 0).toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1">{platformStats?.activeTenants || 0} Active Organizations</p></CardContent></Card>
        <Card className="glass border-accent/20"><CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Coins className="w-3 h-3"/> Platform Revenue</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-accent">GH₵{(platformStats?.totalRevenue || 0).toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1">All-time credits allocated</p></CardContent></Card>
        <Card className="glass"><CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><TrendingUp className="w-3 h-3"/> Global Sent</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-primary">{(platformStats?.totalSent || 0).toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1">Total platform dispatches</p></CardContent></Card>
        <Card className="glass border-destructive/20"><CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><AlertTriangle className="w-3 h-3"/> Global Failures</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-destructive">{(platformStats?.totalFailed || 0).toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1">System-wide errors</p></CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass md:col-span-2 overflow-hidden border-border/40">
          <Tabs defaultValue="active" className="w-full">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-7 border-b border-border bg-muted/5">
              <div className="space-y-4">
                <div>
                  <CardTitle className="text-xl">Organization Directory</CardTitle>
                  <CardDescription>Managing the ministry landscape.</CardDescription>
                </div>
                <TabsList className="bg-muted p-1 rounded-xl w-fit">
                  <TabsTrigger value="active" className="rounded-lg px-6 transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Users className="w-4 h-4 mr-2" /> Active
                  </TabsTrigger>
                  <TabsTrigger value="deleted" className="rounded-lg px-6 transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Archive className="w-4 h-4 mr-2" /> Recycle Bin ({deletedMinistries.length})
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search ministries..." className="pl-10 h-11 bg-white rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 min-h-[400px]">
              <TabsContent value="active" className="mt-0 animate-in fade-in duration-300">
                {isRefreshing && !platformStats ? (
                  <TableSkeleton />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow>
                        <TableHead className="font-bold text-[10px] uppercase">Ministry</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase">Plan</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase">Status</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase">Balance</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeMinistries.map((church: any) => (
                        <TableRow key={church.id} className="group hover:bg-muted/5 transition-colors">
                          <TableCell>
                            <div className="font-bold text-foreground">{church.name}</div>
                            <code className="text-[10px] text-primary">{church.slug}</code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-foreground font-bold">{church.plan || 'Starter'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("uppercase text-[9px] font-bold px-2 py-0.5", church.sms?.subscriptionStatus === 'active' ? "bg-accent text-white" : church.sms?.subscriptionStatus === 'suspended' ? "bg-destructive text-white" : "bg-amber-100 text-amber-700")}>
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
                                <Button variant="ghost" size="icon" className="text-muted-foreground group-hover:bg-white group-hover:shadow-sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="glass w-56">
                                <DropdownMenuItem onClick={() => setEditingOrg(church)} className="font-bold">
                                  <Pencil className="mr-2 h-4 w-4" /> Edit Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setManagingSmsId(church.id)} className="font-bold text-primary">
                                  <Zap className="mr-2 h-4 w-4" /> Top-up Wallet
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {church.sms?.subscriptionStatus !== 'active' ? (
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(church.id, 'active')}>
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-accent" /> Activate Org
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(church.id, 'suspended')} className="text-destructive">
                                    <Ban className="mr-2 h-4 w-4" /> Suspend Service
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setMinistryToDelete(church)} className="text-destructive font-bold focus:bg-destructive focus:text-white">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Ministry
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {activeMinistries.length === 0 && !isRefreshing && (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No active organizations found.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="deleted" className="mt-0 animate-in fade-in duration-300">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] uppercase">Deleted Ministry</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase">Date Deleted</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase">Slug</TableHead>
                      <TableHead className="text-right font-bold text-[10px] uppercase">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedMinistries.map((church: any) => (
                      <TableRow key={church.id} className="opacity-90 bg-muted/5 group hover:bg-muted/10 transition-colors">
                        <TableCell>
                          <div className="font-bold text-foreground flex items-center gap-2">
                            {church.name}
                            <Badge variant="outline" className="text-[8px] uppercase font-bold text-muted-foreground">In Recycle Bin</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {church.deletedAt ? format(new Date(church.deletedAt), 'MMM d, yyyy HH:mm') : 'Unknown'}
                        </TableCell>
                        <TableCell><code className="text-[10px] text-muted-foreground">{church.slug}</code></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 rounded-lg border-primary/20 text-primary hover:bg-primary/10 font-bold transition-all" 
                              onClick={() => handleRestore(church.id)} 
                              disabled={isProcessing}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" /> Restore
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="h-8 rounded-lg font-bold transition-all" 
                              onClick={() => setMinistryToPurge(church)} 
                              disabled={isProcessing}
                            >
                              <Trash2 className="w-3 h-3 mr-1" /> Purge
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {deletedMinistries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-24">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-50">
                            <Archive className="w-12 h-12 mb-2" />
                            <p className="text-sm font-medium">Recycle bin is empty.</p>
                            <p className="text-xs">Deleted ministries will appear here for recovery.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <Card className="glass h-fit border-border/40">
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-widest text-foreground">Top Active Tenants</CardTitle><CardDescription className="text-xs">Based on total SMS dispatches.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {(platformStats?.topSpenders || []).map((spender: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border group hover:border-primary/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">#{i + 1}</div>
                  <div><p className="text-xs font-bold truncate max-w-[120px] text-foreground">{spender.name}</p><p className="text-[10px] text-muted-foreground">{(spender.sent || 0).toLocaleString()} Msgs</p></div>
                </div>
                <div className="text-right"><p className="text-[10px] font-bold text-accent">{(spender.balance || 0).toLocaleString()} Cr</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Action Dialogs */}
      <Dialog open={!!editingOrg} onOpenChange={(o) => !o && setEditingOrg(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Edit Organization</DialogTitle><DialogDescription>Modify primary markers for {editingOrg?.name}.</DialogDescription></DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2"><Label>Ministry Name</Label><Input value={editingOrg?.name || ''} onChange={(e) => setEditingOrg({...editingOrg, name: e.target.value})} className="rounded-xl h-11" /></div>
            <div className="space-y-2"><Label>Tenant Slug</Label><Input value={editingOrg?.slug || ''} onChange={(e) => setEditingOrg({...editingOrg, slug: e.target.value})} className="font-mono rounded-xl h-11" /></div>
            <div className="space-y-2"><Label>Service Plan</Label><Select value={editingOrg?.plan || 'Basic'} onValueChange={(v) => setEditingOrg({...editingOrg, plan: v})}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent className="glass"><SelectItem value="Basic">Starter (Basic)</SelectItem><SelectItem value="Standard">Ministry Growth (Standard)</SelectItem><SelectItem value="Premium">Enterprise (Premium)</SelectItem></SelectContent></Select></div>
            <Button className="w-full bg-primary h-12 rounded-xl mt-4 text-white font-bold" onClick={handleSaveOrg} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!managingSmsId} onOpenChange={(o) => !o && setManagingSmsId(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Wallet Credit Allocation</DialogTitle><DialogDescription>Adding credits for <strong>{activeChurchSms?.name}</strong>.</DialogDescription></DialogHeader>
          <div className="py-6 space-y-4">
            <div className="p-4 rounded-xl bg-muted/20 border border-border flex justify-between items-center"><span className="text-sm font-medium">Current Balance:</span><span className="text-xl font-bold text-foreground">{(activeChurchSms?.sms?.credits || 0).toLocaleString()} Credits</span></div>
            <div className="space-y-2"><Label>SMS Credits to Add</Label><div className="flex gap-2"><Input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} className="h-12 rounded-xl" /><Button className="bg-primary h-12 px-6 rounded-xl text-white" onClick={handleTopUp} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button></div></div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!ministryToDelete} onOpenChange={(o) => !o && setMinistryToDelete(null)}>
        <AlertDialogContent className="glass border-destructive/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-6 w-6" /> Move to Recycle Bin</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 mt-2 text-foreground/80">
                <p>Move <strong>{ministryToDelete?.name}</strong> to the Recycle Bin?</p>
                <div className="p-4 bg-muted/20 rounded-xl border border-border space-y-2">
                  <div className="flex items-start gap-2 text-xs">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p>The organization will be suspended and hidden from the active directory. Data is preserved for potential recovery.</p>
                  </div>
                </div>
                <p className="font-bold text-destructive flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Safety Shield: Org must be SUSPENDED before it can be deleted.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing} className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSoftDelete} className="bg-destructive hover:bg-destructive/90 text-white font-bold rounded-xl" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />} Delete Ministry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!ministryToPurge} onOpenChange={(o) => !o && setMinistryToPurge(null)}>
        <AlertDialogContent className="glass border-destructive/50 bg-destructive/5">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive font-black uppercase tracking-tighter text-2xl flex items-center gap-3">
              <AlertTriangle className="h-8 w-8" /> PERMANENT PURGE
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 mt-4 text-foreground">
                <p className="text-lg font-bold">This is a destructive, non-recoverable action.</p>
                <p>You are about to permanently erase <strong>{ministryToPurge?.name}</strong> and all associated data including:</p>
                <ul className="list-disc pl-6 text-sm font-medium space-y-1">
                  <li>Member directories and profile photos</li>
                  <li>Financial ledgers and SMS transaction logs</li>
                  <li>Attendance records and AI strategy reports</li>
                </ul>
                <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20 mt-4">
                  <p className="text-xs font-bold text-destructive uppercase tracking-widest">Final Confirmation</p>
                  <p className="text-sm font-medium mt-1">This operation cannot be reversed. The data will be scrubbed from all cloud sectors.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel disabled={isProcessing} className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentPurge} className="bg-destructive hover:bg-red-700 text-white font-black h-12 px-8 rounded-xl" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />} PURGE FOREVER
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
