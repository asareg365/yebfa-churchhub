'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Search, Loader2, LogOut, Users, Archive, Pencil, Save, Zap, Trash2, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, auth, functions, useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// Types & Sub-components
import { Church, PlatformStats } from '@/types/admin';
import { StatsCards } from '@/components/admin/StatsCards';
import { OrganizationTable } from '@/components/admin/OrganizationTable';
import { RecycleBinTable } from '@/components/admin/RecycleBinTable';

const SUPER_ADMINS = ['asareg365@gmail.com', 'frankyeb@gmail.com'];

export default function SystemAdminPortal() {
  const { user, loading: userLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Edit State
  const [editingOrg, setEditingOrg] = useState<Church | null>(null);
  const [topUpOrg, setTopUpOrg] = useState<Church | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('100');
  const [deletingOrg, setDeletingOrg] = useState<Church | null>(null);
  const [purgingOrg, setPurgingOrg] = useState<Church | null>(null);
  const [purgeConfirmation, setPurgeConfirmation] = useState('');

  // SSR-Safe Query Definition
  const churchesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'churches'));
  }, [db]);

  const { data: rawChurches, loading: dataLoading } = useCollection<Church>(churchesQuery as any);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !userLoading && (!user || !SUPER_ADMINS.includes(user.email?.toLowerCase() || ''))) {
      router.replace('/admin/login');
    }
  }, [user, userLoading, router, mounted]);

  const activeMinistries = rawChurches.filter(c => 
    c.deletionStatus !== 'DELETED' && 
    (c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.slug?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const deletedMinistries = rawChurches.filter(c => 
    c.deletionStatus === 'DELETED' && 
    (c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.slug?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const platformStats: PlatformStats = {
    totalTenants: rawChurches.filter(c => c.deletionStatus !== 'DELETED').length,
    activeTenants: rawChurches.filter(c => c.sms?.subscriptionStatus === 'active' && c.deletionStatus !== 'DELETED').length,
    totalRevenue: rawChurches.reduce((acc, c) => acc + (Number(c.sms?.totalTopups) || 0), 0),
    totalSent: rawChurches.reduce((acc, c) => acc + (Number(c.sms?.stats?.sent) || 0), 0),
    totalFailed: rawChurches.reduce((acc, c) => acc + (Number(c.sms?.stats?.failed) || 0), 0),
    topSpenders: rawChurches
      .filter(c => c.deletionStatus !== 'DELETED')
      .sort((a, b) => (Number(b.sms?.stats?.sent) || 0) - (Number(a.sms?.stats?.sent) || 0))
      .slice(0, 5)
      .map(c => ({ name: c.name, sent: Number(c.sms?.stats?.sent) || 0, balance: Number(c.sms?.credits) || 0 }))
  };

  const handleUpdateStatus = async (churchId: string, status: string) => {
    if (!functions) {
      toast({
        title: "Firebase not initialized",
        description: "Cloud Functions unavailable.",
        variant: "destructive"
      });
      return;
    }
    setIsProcessing(true);
    try {
      // Diagnostic Token Logging
      const token = await auth.currentUser?.getIdToken(true);
      console.log("Token Refreshed. Length:", token?.length || 0);

      const updateFn = httpsCallable(functions, 'updateChurchStatus');
      await updateFn({ churchId, status });
      toast({ title: "Status Updated", description: `Organization is now ${status}.` });
    } catch (e: any) {
      console.error("ADMIN_ACTION_FAILURE:", e);
      toast({ 
        title: "Operation Failed", 
        description: e.message || "An unexpected error occurred during status update.", 
        variant: "destructive" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!functions || !editingOrg) return;
    setIsProcessing(true);
    try {
      const updateFn = httpsCallable(functions, 'updateOrganization');
      await updateFn({
        churchId: editingOrg.id,
        name: editingOrg.name,
        slug: editingOrg.slug,
        plan: editingOrg.plan,
      });

      toast({ title: "Organization details updated." });
      setEditingOrg(null);
    } catch (e: any) {
      console.error("ORG_UPDATE_FAILURE:", e);
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!functions || !topUpOrg) return;
    const amount = Number(topUpAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      toast({ title: "Invalid top-up amount", description: "Enter a positive whole number of SMS credits.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const topUpFn = httpsCallable(functions, 'adminTopUpWallet');
      const response = await topUpFn({ churchId: topUpOrg.id, amount });
      const result = response.data as { newBalance?: number };
      toast({
        title: "Wallet topped up",
        description: `${amount.toLocaleString()} credits added to ${topUpOrg.name}. New balance: ${Number(result.newBalance || 0).toLocaleString()}.`
      });
      setTopUpOrg(null);
      setTopUpAmount('100');
    } catch (error: any) {
      console.error("WALLET_TOPUP_FAILURE:", error);
      toast({ title: "Top-up failed", description: error.message || "Could not credit this organization's wallet.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteMinistry = async () => {
    if (!functions || !deletingOrg) return;
    setIsProcessing(true);
    try {
      const deleteFn = httpsCallable(functions, 'deleteMinistry');
      await deleteFn({ churchId: deletingOrg.id });
      toast({ title: "Ministry moved to Recycle Bin", description: deletingOrg.name });
      setDeletingOrg(null);
    } catch (error: any) {
      console.error("MINISTRY_DELETE_FAILURE:", error);
      toast({ title: "Delete failed", description: error.message || "Could not delete this ministry. Active services must be suspended first.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurgeMinistry = async () => {
    if (!functions || !purgingOrg) return;
    if (purgeConfirmation.trim() !== purgingOrg.name) {
      toast({ title: "Confirmation does not match", description: "Type the ministry name exactly to permanently purge it.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const purgeFn = httpsCallable(functions, 'hardPurgeMinistry');
      await purgeFn({ churchId: purgingOrg.id });
      toast({ title: "Ministry permanently purged", description: purgingOrg.name });
      setPurgingOrg(null);
      setPurgeConfirmation('');
    } catch (error: any) {
      console.error("MINISTRY_PURGE_FAILURE:", error);
      toast({ title: "Purge failed", description: error.message || "Could not permanently remove this ministry.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async (churchId: string) => {
    if (!functions) return;
    setIsProcessing(true);
    try {
      const restoreFn = httpsCallable(functions, 'restoreMinistry');
      await restoreFn({ churchId });
      toast({ title: "Ministry Restored" });
    } catch (e: any) {
      console.error("RESTORE_FAILURE:", e);
      toast({ title: "Restore Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted || userLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (!user || !SUPER_ADMINS.includes(user.email?.toLowerCase() || '')) return null;

  return (
    <div className="min-h-screen bg-background p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            System Control Center
          </h2>
          <p className="text-muted-foreground text-lg">Global multi-tenant infrastructure management.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => signOut(auth)} className="rounded-xl"><LogOut className="mr-2 h-4 w-4" /> Logout</Button>
        </div>
      </div>

      <StatsCards stats={platformStats} />

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
                  <TabsTrigger value="active" className="rounded-lg px-6">
                    <Users className="w-4 h-4 mr-2" /> Active
                  </TabsTrigger>
                  <TabsTrigger value="deleted" className="rounded-lg px-6">
                    <Archive className="w-4 h-4 mr-2" /> Recycle Bin ({deletedMinistries.length})
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search ministries..." 
                  className="pl-10 h-11 bg-white rounded-xl" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 min-h-[400px]">
              {dataLoading ? (
                <div className="p-8 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
              ) : (
                <>
                  <TabsContent value="active" className="mt-0 animate-in fade-in duration-300">
                    <OrganizationTable 
                      ministries={activeMinistries}
                      onEdit={(church) => setEditingOrg(church)} 
                      onTopUp={(churchId) => { const church = activeMinistries.find(item => item.id === churchId); if (church) { setTopUpOrg(church); setTopUpAmount('100'); } }}
                      onUpdateStatus={handleUpdateStatus}
                      onDelete={(church) => setDeletingOrg(church)}
                    />
                  </TabsContent>
                  <TabsContent value="deleted" className="mt-0 animate-in fade-in duration-300">
                    <RecycleBinTable 
                      ministries={deletedMinistries}
                      isProcessing={isProcessing}
                      onRestore={handleRestore}
                      onPurge={(church) => { setPurgingOrg(church); setPurgeConfirmation(''); }}
                    />
                  </TabsContent>
                </>
              )}
            </CardContent>
          </Tabs>
        </Card>

        <Card className="glass h-fit border-border/40">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-foreground">Top Active Tenants</CardTitle>
            <CardDescription className="text-xs">Based on total SMS dispatches.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {platformStats.topSpenders.map((spender, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border group hover:border-primary/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">#{i + 1}</div>
                  <div>
                    <p className="text-xs font-bold truncate max-w-[120px] text-foreground">{spender.name}</p>
                    <p className="text-[10px] text-muted-foreground">{spender.sent.toLocaleString()} Msgs</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-accent">{spender.balance.toLocaleString()} Cr</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!topUpOrg} onOpenChange={(open) => !open && !isProcessing && setTopUpOrg(null)}>
        <DialogContent className="glass">
          <form onSubmit={handleTopUp}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Top-up SMS Wallet</DialogTitle>
              <DialogDescription>Add SMS credits to {topUpOrg?.name}. The existing server-side wallet limits and authorization checks will still apply.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-6">
              <Label htmlFor="wallet-topup-amount">Credits to add</Label>
              <Input id="wallet-topup-amount" type="number" min="1" step="1" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Current balance: {Number(topUpOrg?.sms?.credits || 0).toLocaleString()} credits</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTopUpOrg(null)} disabled={isProcessing}>Cancel</Button>
              <Button type="submit" disabled={isProcessing}>{isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />} Add Credits</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingOrg} onOpenChange={(open) => !open && !isProcessing && setDeletingOrg(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="w-5 h-5" /> Move Ministry to Recycle Bin?</DialogTitle>
            <DialogDescription>
              {deletingOrg?.name} will be soft-deleted and can be restored later. Its data will not be permanently erased. Suspend its service first if it is active.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingOrg(null)} disabled={isProcessing}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteMinistry} disabled={isProcessing}>{isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />} Move to Recycle Bin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!purgingOrg} onOpenChange={(open) => !open && !isProcessing && setPurgingOrg(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently delete ministry?</DialogTitle>
            <DialogDescription>This action cannot be undone and permanently deletes {purgingOrg?.name} and its subcollection data. Type the ministry name below to confirm.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="purge-confirmation">Ministry name</Label>
            <Input id="purge-confirmation" value={purgeConfirmation} onChange={(e) => setPurgeConfirmation(e.target.value)} placeholder={purgingOrg?.name || "Type ministry name"} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgingOrg(null)} disabled={isProcessing}>Cancel</Button>
            <Button variant="destructive" onClick={handlePurgeMinistry} disabled={isProcessing || purgeConfirmation.trim() !== purgingOrg?.name}>{isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />} Permanently Purge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent className="glass">
          <form onSubmit={handleUpdateOrg}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                Modify Organization
              </DialogTitle>
              <DialogDescription>Update master records for {editingOrg?.name}.</DialogDescription>
            </DialogHeader>
            {editingOrg && (
              <div className="space-y-4 py-6">
                <div className="space-y-2">
                  <Label>Ministry Legal Name</Label>
                  <Input 
                    value={editingOrg.name} 
                    onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })} 
                    className="bg-muted/20"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>System Slug (Tenant ID)</Label>
                  <Input 
                    value={editingOrg.slug} 
                    onChange={(e) => setEditingOrg({ ...editingOrg, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} 
                    className="bg-muted/20 font-mono"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subscription Plan</Label>
                  <Select 
                    value={editingOrg.plan || 'Starter'} 
                    onValueChange={(v) => setEditingOrg({ ...editingOrg, plan: v })}
                  >
                    <SelectTrigger className="bg-muted/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Starter">Starter / Basic</SelectItem>
                      <SelectItem value="Standard">Ministry Growth</SelectItem>
                      <SelectItem value="Premium">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setEditingOrg(null)}>Cancel</Button>
              <Button type="submit" disabled={isProcessing} className="bg-primary px-8">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Commit Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
