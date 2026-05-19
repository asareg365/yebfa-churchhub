
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
  AlertCircle,
  Database,
  User,
  KeyRound,
  Copy,
  Info
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
import { Checkbox } from "@/components/ui/checkbox";
import { useCollection, useFirestore, useUser, useAuth } from "@/firebase";
import { collection, doc, updateDoc, query, setDoc, serverTimestamp, arrayUnion, arrayRemove, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  
  // Dialog States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingChurch, setEditingChurch] = useState<any>(null);
  const [managingUsers, setManagingUsers] = useState<any>(null);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [otpDialog, setOtpDialog] = useState<{ isOpen: boolean, password: string, email: string } | null>(null);
  
  const initialChurchState = {
    name: "",
    slug: "",
    adminEmail: "",
    plan: "Starter" as const,
    status: "Pending" as const,
    enabledModules: ["members", "attendance"]
  };

  const [newChurch, setNewChurch] = useState(initialChurchState);

  // Filter query to match security rules
  const churchesQuery = useMemo(() => {
    if (!user?.email) return null;
    const email = user.email.toLowerCase().trim();
    return query(collection(db, "churches"), where("adminEmails", "array-contains", email));
  }, [db, user?.email]);

  const { data: rawChurches, loading: collectionLoading, error: collectionError } = useCollection(churchesQuery);

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

  const generateOTP = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let otp = "";
    for (let i = 0; i < 8; i++) {
      otp += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return otp;
  };

  const handleAddChurch = async () => {
    if (!newChurch.name || !newChurch.adminEmail) {
      toast({ title: "Missing fields", description: "Name and email are required.", variant: "destructive" });
      return;
    }

    const finalSlug = newChurch.slug || generateSlug(newChurch.name);
    const churchDocRef = doc(db, "churches", finalSlug);
    const otp = generateOTP();
    
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

    setIsAddDialogOpen(false);
    setNewChurch(initialChurchState);

    setDoc(churchDocRef, churchData)
      .then(() => {
        toast({ title: "Ministry Registered", description: `Tenant ID: ${finalSlug} initialized.` });
        setOtpDialog({ isOpen: true, password: otp, email: normalizedAdminEmail });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: churchDocRef.path,
          operation: 'create',
          requestResourceData: churchData,
        });
        errorEmitter.emit('permission-error', permissionError);
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

  const handleAddAdmin = () => {
    if (!managingUsers || !newAdminEmail || !newAdminEmail.includes('@')) return;
    const churchDoc = doc(db, "churches", managingUsers.id);
    const normalizedEmail = newAdminEmail.toLowerCase().trim();
    
    updateDoc(churchDoc, {
      adminEmails: arrayUnion(normalizedEmail)
    })
    .then(() => {
      setNewAdminEmail("");
      setManagingUsers({
        ...managingUsers,
        adminEmails: [...(managingUsers.adminEmails || []), normalizedEmail]
      });
      toast({ title: "Admin user added" });
    })
    .catch(async (error) => {
      const permissionError = new FirestorePermissionError({
        path: churchDoc.path,
        operation: 'update',
        requestResourceData: { adminEmails: normalizedEmail },
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

      <div className="grid gap-6 md:grid-cols-2">
         <Alert className="glass border-primary/20 bg-primary/5">
            <User className="h-4 w-4 text-primary" />
            <AlertTitle>Admin Identity</AlertTitle>
            <AlertDescription className="text-xs font-mono">
              Logged in as: {user?.email?.toLowerCase()}
            </AlertDescription>
         </Alert>
         <Alert className="glass border-accent/20 bg-accent/5">
            <Database className="h-4 w-4 text-accent" />
            <AlertTitle>Directory Status</AlertTitle>
            <AlertDescription className="text-xs">
              Live synchronization active. Showing {sortedChurches.length} organizations.
            </AlertDescription>
         </Alert>
      </div>

      {collectionError && (
        <Alert variant="destructive" className="glass border-destructive/50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Synchronization Error</AlertTitle>
          <AlertDescription>
            Could not retrieve tenant data. Please ensure your query matches system security requirements.
          </AlertDescription>
        </Alert>
      )}

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
                  <TableRow key={church.id} className="border-white/5 hover:bg-white/5 transition-colors border-white/5">
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
                          <DropdownMenuItem onClick={() => setManagingUsers(church)}>
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
                {!collectionLoading && sortedChurches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                      No organizations found in the directory.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* OTP Dialog */}
      <Dialog open={!!otpDialog} onOpenChange={(open) => !open && setOtpDialog(null)}>
        <DialogContent className="glass max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              One-Time Setup Password
            </DialogTitle>
            <DialogDescription>
              A one-time setup password has been generated for the new administrator. 
              Please provide these credentials to them. They will be required to change this password on their first sign-in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2 p-4 rounded-xl bg-white/5 border border-white/10">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Admin Email</Label>
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-mono">{otpDialog?.email}</code>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(otpDialog?.email || "")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2 p-4 rounded-xl bg-primary/10 border border-primary/20">
              <Label className="text-xs uppercase tracking-wider text-primary font-bold">One-Time Password</Label>
              <div className="flex items-center justify-between gap-2">
                <code className="text-lg font-bold font-mono tracking-widest text-primary">{otpDialog?.password}</code>
                <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/20" onClick={() => copyToClipboard(otpDialog?.password || "")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Alert className="bg-accent/5 border-accent/20">
              <Info className="h-4 w-4 text-accent" />
              <AlertDescription className="text-xs">
                Important: Create the Auth account in the Firebase console or share these credentials for the admin to claim their church.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setOtpDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Church Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) setNewChurch(initialChurchState);
      }}>
        <DialogContent className="glass max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Onboard New Organization</DialogTitle>
            <DialogDescription>Assign a permanent name and Tenant ID to the new church.</DialogDescription>
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
            <div className="space-y-2">
              <Label>Primary Admin Email</Label>
              <Input 
                type="email"
                placeholder="admin@email.org"
                value={newChurch.adminEmail} 
                onChange={(e) => setNewChurch({...newChurch, adminEmail: e.target.value})} 
                className="bg-white/5"
              />
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
            <Button onClick={handleAddChurch}>
              Register Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Church Dialog */}
      <Dialog open={!!editingChurch} onOpenChange={(open) => !open && setEditingChurch(null)}>
        <DialogContent className="glass max-w-lg max-h-[90vh] overflow-y-auto">
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
      <Dialog open={!!managingUsers} onOpenChange={(open) => !open && setManagingUsers(null)}>
        <DialogContent className="glass max-w-md">
          <DialogHeader>
            <DialogTitle>Authorized Administrators</DialogTitle>
            <DialogDescription>Manage organizational access for {managingUsers?.name}.</DialogDescription>
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
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Admins</Label>
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
