
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  Users, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Building2,
  Clock,
  PlusCircle,
  Pencil,
  UserPlus,
  Trash2,
  Mail,
  Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, doc, updateDoc, query, orderBy, Timestamp, addDoc, serverTimestamp, getDocs, where, arrayUnion, arrayRemove } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];

export default function SystemAdminPortal() {
  const { user, loading: userLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);
  const [isAddingChurch, setIsAddingChurch] = useState(false);
  
  // Dialog States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingChurch, setEditingChurch] = useState<any>(null);
  const [managingUsers, setManagingUsers] = useState<any>(null);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  
  const [newChurch, setNewChurch] = useState({
    name: "",
    adminEmail: "",
    plan: "Starter",
    status: "Pending"
  });

  const churchesQuery = useMemo(() => {
    return query(collection(db, "churches"), orderBy("registeredAt", "desc"));
  }, [db]);

  const { data: churches, loading: collectionLoading } = useCollection(churchesQuery);

  useEffect(() => {
    if (!userLoading && (!user || !SUPER_ADMINS.includes(user.email || ""))) {
      router.push("/dashboard");
    }
  }, [user, userLoading, router]);

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    const churchesRef = collection(db, "churches");
    
    try {
      const q = query(churchesRef, where("name", "==", "Grace Community Sanctuary"));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        toast({ title: "Ministry already exists", description: "Grace Community Sanctuary is already in the directory." });
        setIsSeeding(false);
        return;
      }

      const demoData = {
        name: "Grace Community Sanctuary",
        adminEmail: "admin@gracecommunity.org",
        adminEmails: ["admin@gracecommunity.org"],
        status: "Pending",
        plan: "Premium",
        registeredAt: serverTimestamp()
      };

      addDoc(churchesRef, demoData)
        .then(() => {
          toast({ title: "Ministry Seeded!", description: "Grace Community Sanctuary has been added." });
        })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: churchesRef.path,
            operation: 'create',
            requestResourceData: demoData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    } catch (e) {
      toast({ title: "Seeding failed", variant: "destructive" });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAddChurch = async () => {
    if (!newChurch.name || !newChurch.adminEmail) {
      toast({ title: "Missing fields", description: "Please provide a name and admin email.", variant: "destructive" });
      return;
    }

    setIsAddingChurch(true);
    const churchesRef = collection(db, "churches");
    
    const churchData = {
      ...newChurch,
      adminEmails: [newChurch.adminEmail],
      registeredAt: serverTimestamp()
    };

    addDoc(churchesRef, churchData)
      .then(() => {
        setIsAddDialogOpen(false);
        setNewChurch({ name: "", adminEmail: "", plan: "Starter", status: "Pending" });
        toast({ title: "Ministry Registered", description: `${newChurch.name} has been added to the system.` });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: churchesRef.path,
          operation: 'create',
          requestResourceData: churchData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsAddingChurch(false);
      });
  };

  const handleUpdateStatus = (churchId: string, newStatus: string) => {
    const churchDoc = doc(db, "churches", churchId);
    updateDoc(churchDoc, { status: newStatus })
      .then(() => {
        toast({ title: `Status updated to ${newStatus}` });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: churchDoc.path,
          operation: 'update',
          requestResourceData: { status: newStatus },
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleSaveChurchDetails = () => {
    if (!editingChurch) return;
    const churchDoc = doc(db, "churches", editingChurch.id);
    const updateData = {
      name: editingChurch.name,
      plan: editingChurch.plan,
      status: editingChurch.status,
    };

    updateDoc(churchDoc, updateData)
      .then(() => {
        setEditingChurch(null);
        toast({ title: "Ministry details updated" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: churchDoc.path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleAddAdmin = () => {
    if (!managingUsers || !newAdminEmail || !newAdminEmail.includes('@')) return;
    const churchDoc = doc(db, "churches", managingUsers.id);
    
    updateDoc(churchDoc, {
      adminEmails: arrayUnion(newAdminEmail)
    })
    .then(() => {
      setNewAdminEmail("");
      setManagingUsers({
        ...managingUsers,
        adminEmails: [...(managingUsers.adminEmails || []), newAdminEmail]
      });
      toast({ title: "Admin user added" });
    })
    .catch(async (error) => {
      const permissionError = new FirestorePermissionError({
        path: churchDoc.path,
        operation: 'update',
        requestResourceData: { adminEmails: newAdminEmail },
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleRemoveAdmin = (email: string) => {
    if (!managingUsers) return;
    const churchDoc = doc(db, "churches", managingUsers.id);
    
    updateDoc(churchDoc, {
      adminEmails: arrayRemove(email)
    })
    .then(() => {
      setManagingUsers({
        ...managingUsers,
        adminEmails: (managingUsers.adminEmails || []).filter((e: string) => e !== email)
      });
      toast({ title: "Admin user removed" });
    })
    .catch(async (error) => {
      const permissionError = new FirestorePermissionError({
        path: churchDoc.path,
        operation: 'update',
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  if (userLoading || !user || !SUPER_ADMINS.includes(user.email || "")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const filteredChurches = (churches || []).filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.adminEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Just now';
    if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString();
    if (ts && typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleDateString();
    if (ts instanceof Date) return ts.toLocaleDateString();
    return 'Processing...';
  };

  return (
    <div className="min-h-screen bg-background p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            System Admin Portal
          </h2>
          <p className="text-muted-foreground text-lg">Manage ministry registrations, authorized users, and approvals.</p>
        </div>
        <div className="flex gap-4">
          <Button 
            onClick={() => setIsAddDialogOpen(true)} 
            className="bg-primary hover:bg-primary/90 rounded-xl"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Ministry
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSeedDemo} 
            disabled={isSeeding}
            className="glass border-primary/20 hover:bg-primary/10 text-primary"
          >
            {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Seed Grace Community
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")} className="glass border-white/10">
            Back to Dashboard
          </Button>
        </div>
      </div>

      <Card className="glass border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div>
            <CardTitle className="text-xl">Ministry Directory</CardTitle>
            <CardDescription>Configure church details and manage tenant administrators.</CardDescription>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or email..." 
              className="pl-10 bg-white/5 border-white/10 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {collectionLoading ? (
            <div className="p-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5">
                  <TableHead>Church Name</TableHead>
                  <TableHead>Primary Admin</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChurches.map((church) => (
                  <TableRow key={church.id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="font-bold">{church.name}</TableCell>
                    <TableCell className="text-muted-foreground">{church.adminEmail}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                        {church.plan || "Starter"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "capitalize",
                        church.status === 'Approved' ? 'bg-green-500/10 text-green-500' : 
                        church.status === 'Pending' ? 'bg-accent/10 text-accent' : 
                        'bg-destructive/10 text-destructive'
                      )}>
                        {church.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimestamp(church.registeredAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass">
                          <DropdownMenuItem onClick={() => setEditingChurch(church)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setManagingUsers(church)}>
                            <UserPlus className="mr-2 h-4 w-4" /> Manage Admins
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem 
                            className="text-green-500 focus:text-green-500"
                            onClick={() => handleUpdateStatus(church.id, "Approved")}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Approve & Activate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleUpdateStatus(church.id, "Suspended")}
                          >
                            <XCircle className="mr-2 h-4 w-4" /> Suspend Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Church Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="glass max-w-md">
          <DialogHeader>
            <DialogTitle>Register New Ministry</DialogTitle>
            <DialogDescription>Manually add a new organization to the hub.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ministry Name</Label>
              <Input 
                placeholder="e.g. Hope Sanctuary"
                value={newChurch.name} 
                onChange={(e) => setNewChurch({...newChurch, name: e.target.value})} 
                className="bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label>Primary Admin Email</Label>
              <Input 
                type="email"
                placeholder="admin@hopesanctuary.org"
                value={newChurch.adminEmail} 
                onChange={(e) => setNewChurch({...newChurch, adminEmail: e.target.value})} 
                className="bg-white/5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Service Plan</Label>
                <Select 
                  value={newChurch.plan} 
                  onValueChange={(v) => setNewChurch({...newChurch, plan: v})}
                >
                  <SelectTrigger className="bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass">
                    <SelectItem value="Starter">Starter</SelectItem>
                    <SelectItem value="Growth">Growth</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Initial Status</Label>
                <Select 
                  value={newChurch.status} 
                  onValueChange={(v) => setNewChurch({...newChurch, status: v})}
                >
                  <SelectTrigger className="bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass">
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddChurch} disabled={isAddingChurch}>
              {isAddingChurch && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register Ministry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Church Dialog */}
      <Dialog open={!!editingChurch} onOpenChange={(open) => !open && setEditingChurch(null)}>
        <DialogContent className="glass max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Ministry Details</DialogTitle>
            <DialogDescription>Update the core identification and status of this organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ministry Name</Label>
              <Input 
                value={editingChurch?.name || ""} 
                onChange={(e) => setEditingChurch({...editingChurch, name: e.target.value})} 
                className="bg-white/5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Service Plan</Label>
                <Select 
                  value={editingChurch?.plan || "Starter"} 
                  onValueChange={(v) => setEditingChurch({...editingChurch, plan: v})}
                >
                  <SelectTrigger className="bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass">
                    <SelectItem value="Starter">Starter</SelectItem>
                    <SelectItem value="Growth">Growth</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account Status</Label>
                <Select 
                  value={editingChurch?.status || "Pending"} 
                  onValueChange={(v) => setEditingChurch({...editingChurch, status: v})}
                >
                  <SelectTrigger className="bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass">
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingChurch(null)}>Cancel</Button>
            <Button onClick={handleSaveChurchDetails}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Admins Dialog */}
      <Dialog open={!!managingUsers} onOpenChange={(open) => !open && setManagingUsers(null)}>
        <DialogContent className="glass max-w-md">
          <DialogHeader>
            <DialogTitle>Authorized Administrators</DialogTitle>
            <DialogDescription>Manage who has access to the dashboard for {managingUsers?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="admin@email.com" 
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="pl-10 bg-white/5"
                />
              </div>
              <Button onClick={handleAddAdmin} disabled={!newAdminEmail}>
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Admins</Label>
              <div className="rounded-xl border border-white/5 overflow-hidden">
                {managingUsers?.adminEmails?.length > 0 ? (
                  managingUsers.adminEmails.map((email: string) => (
                    <div key={email} className="flex items-center justify-between p-3 bg-white/5 border-b border-white/5 last:border-0">
                      <span className="text-sm font-medium">{email}</span>
                      {email !== managingUsers.adminEmail && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveAdmin(email)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Only the primary admin has access.
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setManagingUsers(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
