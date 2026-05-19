
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  Loader2,
  Pencil,
  UserPlus,
  Trash2,
  Mail,
  Plus,
  PlusCircle,
  Hash,
  LogOut,
  Calendar,
  KeyRound,
  Copy,
  Info,
  SendHorizontal,
  Lock
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCollection, useFirestore, useUser, useAuth } from "@/firebase";
import { collection, doc, updateDoc, query, setDoc, serverTimestamp, arrayUnion, arrayRemove, where } from "firebase/firestore";
import { signOut, createUserWithEmailAndPassword, getAuth, signOut as authSignOut, sendPasswordResetEmail } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { firebaseConfig } from "@/firebase/config";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];

const MODULES = [
  { id: "members", label: "Members Management" },
  { id: "attendance", label: "Attendance Tracking" },
  { id: "events", label: "Event Planning" },
  { id: "finances", label: "Financial Records" },
  { id: "communication", label: "AI Communications" },
  { id: "insights", label: "Pastoral Insights" },
  { id: "reports", label: "Detailed Reports" },
];

export default function SystemAdminPortal() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingChurch, setEditingChurch] = useState<any>(null);
  const [managingUsersId, setManagingUsersId] = useState<string | null>(null);
  
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [adminToRemove, setAdminToRemove] = useState<{ email: string; churchId: string } | null>(null);
  
  const initialChurchState = {
    name: "",
    slug: "",
    adminEmail: "",
    adminPassword: "",
    plan: "Starter" as const,
    status: "Approved" as const,
    enabledModules: ["members", "attendance"]
  };

  const [newChurch, setNewChurch] = useState(initialChurchState);

  const churchesQuery = useMemo(() => {
    if (!user?.email) return null;
    const email = user.email.toLowerCase().trim();
    if (SUPER_ADMINS.includes(email)) {
      return query(collection(db, "churches"));
    }
    return query(collection(db, "churches"), where("adminEmails", "array-contains", email));
  }, [db, user?.email]);

  const { data: rawChurches, loading: collectionLoading } = useCollection(churchesQuery);

  const sortedChurches = useMemo(() => {
    if (!rawChurches) return [];
    const filtered = rawChurches.filter(c => 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.adminEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return [...filtered].sort((a: any, b: any) => {
      const dateA = a.registeredAt?.toDate?.() || new Date(0);
      const dateB = b.registeredAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [rawChurches, searchTerm]);

  const managingUsers = useMemo(() => {
    return sortedChurches.find(c => c.id === managingUsersId) || null;
  }, [sortedChurches, managingUsersId]);

  useEffect(() => {
    if (!userLoading) {
      if (!user) {
        router.push("/admin/login");
      } else if (!SUPER_ADMINS.includes(user.email?.toLowerCase() || "")) {
        router.push("/dashboard");
      }
    }
  }, [user, userLoading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/admin/login");
      toast({ title: "Logged out", description: "Administrator session securely ended." });
    } catch (error: any) {
      toast({ title: "Logout failed", description: error.message, variant: "destructive" });
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').trim();
  };

  const handleAddChurch = async () => {
    if (!newChurch.name || !newChurch.adminEmail || !newChurch.adminPassword) {
      toast({ title: "Missing fields", description: "Name, email, and password are required.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    const finalSlug = newChurch.slug || generateSlug(newChurch.name);
    const churchDocRef = doc(db, "churches", finalSlug);
    
    const normalizedAdminEmail = newChurch.adminEmail.toLowerCase().trim();
    const authorizedEmails = Array.from(new Set([
      normalizedAdminEmail, 
      ...SUPER_ADMINS.map(email => email.toLowerCase().trim())
    ]));

    const churchData = {
      name: newChurch.name,
      slug: finalSlug,
      adminEmail: normalizedAdminEmail,
      adminEmails: authorizedEmails,
      plan: newChurch.plan,
      status: newChurch.status,
      enabledModules: newChurch.enabledModules,
      mustChangePassword: true,
      registeredAt: serverTimestamp(),
      settings: {
        birthdaySmsEnabled: true,
        lowCreditAlertEnabled: true,
        dailyReportsEnabled: false
      }
    };

    try {
      await setDoc(churchDocRef, churchData);
      
      const secondaryApp = initializeApp(firebaseConfig, `AuthCreation-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      
      try {
        await createUserWithEmailAndPassword(secondaryAuth, normalizedAdminEmail, newChurch.adminPassword);
        await authSignOut(secondaryAuth);
      } catch (authError: any) {
        if (authError.code !== 'auth/email-already-in-use') {
          console.error("Auth creation failed:", authError);
        }
      } finally {
        await deleteApp(secondaryApp);
      }

      setIsAddDialogOpen(false);
      setNewChurch(initialChurchState);
      toast({ title: "Ministry Registered", description: `Tenant ID: ${finalSlug} is now active.` });
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: churchDocRef.path,
        operation: 'create',
        requestResourceData: churchData,
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setIsProcessing(false);
    }
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
      enabledModules: editingChurch.enabledModules || []
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

  const toggleModuleInState = (state: any, setState: any, moduleId: string) => {
    const currentModules = state.enabledModules || [];
    const updatedModules = currentModules.includes(moduleId)
      ? currentModules.filter((id: string) => id !== moduleId)
      : [...currentModules, moduleId];
    setState({ ...state, enabledModules: updatedModules });
  };

  const handleAddAdmin = async () => {
    if (!managingUsers || !newAdminEmail || !newAdminEmail.includes('@') || !newAdminPassword) {
      toast({ title: "Required", description: "Email and password are required.", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    const churchDoc = doc(db, "churches", managingUsers.id);
    const normalizedEmail = newAdminEmail.toLowerCase().trim();
    
    try {
      const secondaryApp = initializeApp(firebaseConfig, `AuthAdmin-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      
      try {
        await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, newAdminPassword);
        await authSignOut(secondaryAuth);
      } catch (authError: any) {
        if (authError.code !== 'auth/email-already-in-use') {
          console.error("Auth creation failed:", authError);
        }
      } finally {
        await deleteApp(secondaryApp);
      }

      await updateDoc(churchDoc, {
        adminEmails: arrayUnion(normalizedEmail)
      });

      setNewAdminEmail("");
      setNewAdminPassword("");
      toast({ title: "Admin user added" });
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: churchDoc.path,
        operation: 'update',
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveAdmin = (email: string, churchId: string) => {
    const churchDoc = doc(db, "churches", churchId);
    updateDoc(churchDoc, {
      adminEmails: arrayRemove(email)
    })
    .then(() => {
      setAdminToRemove(null);
      toast({ title: "Admin user access revoked" });
    })
    .catch(async (error) => {
      const permissionError = new FirestorePermissionError({
        path: churchDoc.path,
        operation: 'update',
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleTriggerReset = (email: string) => {
    sendPasswordResetEmail(auth, email)
      .then(() => {
        toast({ title: "Reset link sent", description: `A password reset link was sent to ${email}.` });
      })
      .catch((error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      });
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return "Just now";
    if (ts.toDate) return ts.toDate().toLocaleDateString();
    return "Processing...";
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            System Admin Portal
          </h2>
          <p className="text-muted-foreground text-lg">Manage organizational tenants, slugs, and system module access.</p>
        </div>
        <div className="flex gap-4">
          <Button 
            onClick={() => setIsAddDialogOpen(true)} 
            className="bg-primary hover:bg-primary/90 rounded-xl"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Ministry
          </Button>
          <Button variant="outline" onClick={handleLogout} className="glass border-white/10 text-destructive hover:bg-destructive/10">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      <Card className="glass border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div>
            <CardTitle className="text-xl">Tenant Directory</CardTitle>
            <CardDescription>Configure ministry identification slugs and manage system administrators.</CardDescription>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or slug..." 
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
                  <TableHead>Ministry Name</TableHead>
                  <TableHead>Tenant ID (Slug)</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedChurches.map((church) => (
                  <TableRow key={church.id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="font-bold">{church.name}</TableCell>
                    <TableCell>
                      <code className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold">
                        {church.slug}
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 opacity-50" />
                        {formatTimestamp(church.registeredAt)}
                      </div>
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
                          <DropdownMenuItem onClick={() => setManagingUsersId(church.id)}>
                            <UserPlus className="mr-2 h-4 w-4" /> Manage Admins
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem 
                            className="text-green-500 focus:text-green-500"
                            onClick={() => handleUpdateStatus(church.id, "Approved")}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Tenant
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

      {/* Onboard New Ministry Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) setNewChurch(initialChurchState);
      }}>
        <DialogContent className="glass max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Onboard New Organization</DialogTitle>
            <DialogDescription>Assign a permanent name, Tenant ID, and initial access password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ministry Name</Label>
              <Input 
                placeholder="e.g. Hope Sanctuary"
                value={newChurch.name} 
                onChange={(e) => {
                  const val = e.target.value;
                  setNewChurch({...newChurch, name: val, slug: generateSlug(val)});
                }} 
                className="bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label>Tenant ID (Permanent Slug)</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={newChurch.slug} 
                  onChange={(e) => setNewChurch({...newChurch, slug: generateSlug(e.target.value)})}
                  placeholder="hope-sanctuary"
                  className="pl-10 bg-white/5 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Admin Email</Label>
                <Input 
                  type="email"
                  placeholder="admin@email.org"
                  value={newChurch.adminEmail} 
                  onChange={(e) => setNewChurch({...newChurch, adminEmail: e.target.value})} 
                  className="bg-white/5"
                />
              </div>
              <div className="space-y-2">
                <Label>Admin Password</Label>
                <Input 
                  type="password"
                  placeholder="Enter secure password"
                  value={newChurch.adminPassword} 
                  onChange={(e) => setNewChurch({...newChurch, adminPassword: e.target.value})} 
                  className="bg-white/5"
                />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Features to Enable</Label>
              <div className="grid grid-cols-2 gap-2">
                {MODULES.map((module) => (
                  <div key={module.id} className="flex items-center space-x-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                    <Checkbox 
                      id={`new-${module.id}`} 
                      checked={newChurch.enabledModules.includes(module.id)}
                      onCheckedChange={() => toggleModuleInState(newChurch, setNewChurch, module.id)}
                    />
                    <label htmlFor={`new-${module.id}`} className="text-sm cursor-pointer flex-1">
                      {module.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddChurch} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Register & Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Church Dialog */}
      <Dialog open={!!editingChurch} onOpenChange={(open) => !open && setEditingChurch(null)}>
        <DialogContent className="glass max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Organization Configuration</DialogTitle>
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
            <div className="space-y-3 pt-4 border-t border-white/5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Features Enabled</Label>
              <div className="grid grid-cols-2 gap-2">
                {MODULES.map((module) => (
                  <div key={module.id} className="flex items-center space-x-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                    <Checkbox 
                      id={`edit-${module.id}`} 
                      checked={editingChurch?.enabledModules?.includes(module.id)}
                      onCheckedChange={() => toggleModuleInState(editingChurch, setEditingChurch, module.id)}
                    />
                    <label htmlFor={`edit-${module.id}`} className="text-sm cursor-pointer flex-1">
                      {module.label}
                    </label>
                  </div>
                ))}
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
      <Dialog open={!!managingUsersId} onOpenChange={(open) => !open && setManagingUsersId(null)}>
        <DialogContent className="glass max-w-md">
          <DialogHeader>
            <DialogTitle>Authorized Administrators</DialogTitle>
            <DialogDescription>Manage access for {managingUsers?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Add New Admin</Label>
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Email Address" 
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="pl-10 bg-white/5"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="password"
                      placeholder="Assign Password" 
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="pl-10 bg-white/5"
                    />
                  </div>
                  <Button onClick={handleAddAdmin} disabled={!newAdminEmail || !newAdminPassword || isProcessing} className="w-full">
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                    Add Administrator
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Admins</Label>
              <div className="rounded-xl border border-white/5 overflow-hidden">
                {managingUsers?.adminEmails?.length > 0 ? (
                  Array.from(new Set(managingUsers.adminEmails as string[])).map((email: string) => (
                    <div key={email} className="flex items-center justify-between p-3 bg-white/5 border-b border-white/5 last:border-0 group">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{email}</span>
                        {email === managingUsers.adminEmail && <span className="text-[10px] text-primary uppercase font-bold">Owner</span>}
                        {SUPER_ADMINS.includes(email) && <span className="text-[10px] text-accent uppercase font-bold">System Admin</span>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-primary hover:bg-primary/10"
                          onClick={() => handleTriggerReset(email)}
                          title="Send Password Reset"
                        >
                          <SendHorizontal className="h-4 w-4" />
                        </Button>
                        {!SUPER_ADMINS.includes(email) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.preventDefault();
                              if (managingUsersId) {
                                setAdminToRemove({ email, churchId: managingUsersId });
                              }
                            }}
                            title="Remove Admin"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
            <Button className="w-full" onClick={() => setManagingUsersId(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Removal Alert Dialog */}
      <AlertDialog 
        open={!!adminToRemove} 
        onOpenChange={(open) => !open && setAdminToRemove(null)}
      >
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Admin Access?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{adminToRemove?.email}</strong>? They will immediately lose access to this organization's dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAdminToRemove(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                if (adminToRemove) {
                  handleRemoveAdmin(adminToRemove.email, adminToRemove.churchId);
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
