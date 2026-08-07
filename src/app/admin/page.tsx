'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Search, Loader2, LogOut, RefreshCcw, Archive, Users, AlertTriangle, Pencil, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, auth, functions, useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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

  // Real-time listener for churches
  const churchesQuery = query(collection(db, 'churches'));
  const { data: rawChurches, loading: dataLoading } = useCollection<Church>(churchesQuery);

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

  // Aggregate Stats
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
    if (!functions) return;
    setIsProcessing(true);
    try {
      // Refresh identity token to ensure Super Admin claims are active
      await auth.currentUser?.getIdToken(true);

      const updateFn = httpsCallable(functions, 'updateChurchStatus');
      await updateFn({ churchId, status });
      toast({ title: "Status Updated", description: `Organization is now ${status}.` });
    } catch (e: any) {
      console.error("Cloud Function Error:", e);
      toast({ title: "Operation Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!functions || !editingOrg) return;
    setIsProcessing(true);
    try {
      // Forced Token Refresh before sensitive data mutation
      await auth.currentUser?.getIdToken(true);

      const updateFn = httpsCallable(functions, 'updateOrganization');
      await updateFn({
        churchId: editingOrg.id,
        name: editingOrg.name,
        slug: editingOrg.slug,
        plan: editingOrg.plan,
      });

      toast({ title: "Organization details updated successfully." });
      setEditingOrg(null);
    } catch (e: any) {
      console.error("Cloud Function Error:", e);
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async (churchId: string) => {
    if (!functions) return;
    setIsProcessing(true);
    try {
      await auth.currentUser?.getIdToken(true);
      const restoreFn = httpsCallable(functions, 'restoreMinistry');
      await restoreFn({ churchId });
      toast({ title: "Ministry Restored" });
    } catch (e: any) {
      console.error("Cloud Function Error:", e);
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
                      onTopUp={() => {}}
                      onUpdateStatus={handleUpdateStatus}
                      onDelete={() => {}}
                    />
                  </TabsContent>
                  <TabsContent value="deleted" className="mt-0 animate-in fade-in duration-300">
                    <RecycleBinTable 
                      ministries={deletedMinistries}
                      isProcessing={isProcessing}
                      onRestore={handleRestore}
                      onPurge={() => {}}
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
