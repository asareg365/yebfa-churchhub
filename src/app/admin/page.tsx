
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
  Ban
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
import { useCollection, useFirestore, useUser, useAuth } from '@/firebase';
import {
  collection,
  doc,
  updateDoc,
  query,
  serverTimestamp,
  increment,
  addDoc,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const SUPER_ADMINS = ['asareg365@gmail.com', 'frankyeb@gmail.com'];

export default function SystemAdminPortal() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [managingSmsId, setManagingSmsId] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('500');

  // Memoized query that only executes if the user is a verified super admin
  const churchesQuery = useMemo(() => {
    const email = user?.email?.toLowerCase().trim();
    if (!user || !email || !SUPER_ADMINS.includes(email)) return null;
    return query(collection(db, 'churches'));
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

  const handleApproveSms = async (churchId: string) => {
    const churchRef = doc(db, 'churches', churchId);
    try {
      await updateDoc(churchRef, {
        "sms.subscriptionStatus": "active",
        "sms.enabled": true,
        "sms.credits": 100,
        "sms.approvedAt": serverTimestamp(),
        "sms.approvedBy": user?.email
      });
      toast({ title: "SMS Service Activated", description: "Default 100 credits allocated." });
    } catch (e: any) {
      toast({ title: "Activation Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleSms = async (churchId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'churches', churchId), { "sms.enabled": !currentStatus });
      toast({ title: currentStatus ? "SMS Suspended" : "SMS Re-activated" });
    } catch (e: any) {
      toast({ title: "Operation Failed", variant: "destructive" });
    }
  };

  const handleTopUp = async () => {
    if (!managingSmsId || !topUpAmount) return;
    setIsProcessing(true);
    const churchRef = doc(db, 'churches', managingSmsId);
    const txRef = collection(db, 'churches', managingSmsId, 'smsTransactions');
    const amount = parseInt(topUpAmount);

    try {
      await updateDoc(churchRef, { "sms.credits": increment(amount) });
      await addDoc(txRef, {
        type: "credit",
        amount,
        reason: "admin_manual_topup",
        processedBy: user?.email,
        createdAt: serverTimestamp()
      });
      toast({ title: "Credits Added Successfully", description: `${amount} credits added to ${activeChurchSms?.name}` });
      setManagingSmsId(null);
    } catch (e: any) {
      toast({ title: "Top-up Failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Block rendering and data fetching if unauthorized
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
          <h2 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            System Control Center
          </h2>
          <p className="text-muted-foreground text-lg">Multi-tenant organizational management & resource allocation.</p>
        </div>
        <Button variant="outline" onClick={() => signOut(auth)} className="rounded-xl">
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Total Tenants</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{sortedChurches.length}</div></CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Active SMS Nodes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-accent">{sortedChurches.filter(c => c.sms?.enabled).length}</div></CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Pending Approvals</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{sortedChurches.filter(c => c.sms?.subscriptionStatus === 'pending').length}</div></CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">System Health</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">Stable</div></CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-7">
          <div>
            <CardTitle>Organization Directory</CardTitle>
            <CardDescription>Manage tenant lifecycles and SMS credit allocation.</CardDescription>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search churches..." className="pl-10 h-11" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ministry</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>SMS Status</TableHead>
                <TableHead>SMS Balance</TableHead>
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
                    {church.sms?.subscriptionStatus === 'active' ? (
                      <Badge className={cn(church.sms?.enabled ? "bg-accent text-white" : "bg-destructive text-white")}>
                        {church.sms?.enabled ? 'Active' : 'Suspended'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700">Pending Approval</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono font-bold">{(church.sms?.credits || 0).toLocaleString()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {church.sms?.subscriptionStatus !== 'active' ? (
                          <DropdownMenuItem onClick={() => handleApproveSms(church.id)} className="text-accent font-bold">
                            <CheckCircle className="mr-2 h-4 w-4" /> Approve SMS
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => setManagingSmsId(church.id)}>
                              <Zap className="mr-2 h-4 w-4" /> Allocate Credits
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleSms(church.id, church.sms?.enabled)}>
                              {church.sms?.enabled ? (
                                <><Ban className="mr-2 h-4 w-4 text-destructive" /> Suspend Service</>
                              ) : (
                                <><CheckCircle2 className="mr-2 h-4 w-4 text-accent" /> Activate Service</>
                              )}
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Tenant</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!collectionLoading && sortedChurches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
                    No organizations found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Credit Allocation Dialog */}
      <Dialog open={!!managingSmsId} onOpenChange={(o) => !o && setManagingSmsId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SMS Credit Management</DialogTitle>
            <DialogDescription>Allocating resources for <strong>{activeChurchSms?.name}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="p-4 rounded-xl bg-muted/20 border flex justify-between items-center">
              <span className="text-sm font-medium">Current Balance:</span>
              <span className="text-xl font-bold">{(activeChurchSms?.sms?.credits || 0).toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              <Label>Credits to Add</Label>
              <div className="flex gap-2">
                <Input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} />
                <Button className="bg-primary" onClick={handleTopUp} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['100', '500', '1000', '2000', '5000'].map(val => (
                <Button key={val} variant="outline" size="sm" onClick={() => setTopUpAmount(val)}>+{val}</Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagingSmsId(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
