
"use client";

import { useState, useMemo } from "react";
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Loader2, 
  Users as UsersIcon, 
  Trash2, 
  FileUp, 
  Check, 
  Pencil,
  AlertTriangle,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  DialogTrigger, 
  DialogFooter, 
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, deleteDoc, query, where, limit, writeBatch, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

const DEPARTMENTS = ["Music", "Youth", "Media", "Children", "Welfare", "Ushering", "Evangelism"];

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkData, setBulkData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<any>(null);
  const [editingMember, setEditingMember] = useState<any>(null);

  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];
  const membersRef = useMemo(() => currentChurch?.id ? collection(db, "churches", currentChurch.id, "members") : null, [db, currentChurch?.id]);
  const { data: members, loading } = useCollection(membersRef);

  const [newMember, setNewMember] = useState({
    name: "",
    department: "Music",
    status: "Active" as const,
    gender: "Male" as const,
    dateOfBirth: "",
    phone: ""
  });

  const calculateBirthdayKey = (dobString: string) => {
    if (!dobString) return "";
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return "";
    const month = String(dob.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dob.getUTCDate()).padStart(2, '0');
    return `${month}${day}`;
  };

  const handleAddMember = async () => {
    if (!newMember.name || !newMember.dateOfBirth || !membersRef) {
      toast({ title: "Incomplete data", description: "Name and Date of Birth are required.", variant: "destructive" });
      return;
    }
    const memberData = {
      ...newMember,
      birthdayKey: calculateBirthdayKey(newMember.dateOfBirth),
      joined: new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp(),
      photo: `https://picsum.photos/seed/${Math.random()}/100/100`
    };
    try {
      await addDoc(membersRef, memberData);
      setIsAddDialogOpen(false);
      setNewMember({ name: "", department: "Music", status: "Active", gender: "Male", dateOfBirth: "", phone: "" });
      toast({ title: "Member added successfully" });
    } catch (e) {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handleUpdateMember = async () => {
    if (!editingMember || !membersRef) return;
    try {
      const docRef = doc(membersRef, editingMember.id);
      await updateDoc(docRef, {
        name: editingMember.name,
        phone: editingMember.phone,
        gender: editingMember.gender,
        department: editingMember.department,
        status: editingMember.status,
        dateOfBirth: editingMember.dateOfBirth,
        birthdayKey: calculateBirthdayKey(editingMember.dateOfBirth),
        updatedAt: serverTimestamp()
      });
      setIsEditDialogOpen(false);
      setEditingMember(null);
      toast({ title: "Profile updated" });
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete || !membersRef) return;
    try {
      await deleteDoc(doc(membersRef, memberToDelete.id));
      setMemberToDelete(null);
      toast({ title: "Member removed from directory" });
    } catch (e) {
      toast({ title: "Deletion failed", variant: "destructive" });
    }
  };

  const handleBulkImport = async () => {
    if (!bulkData || !membersRef || !currentChurch) return;
    setIsImporting(true);
    const batch = writeBatch(db);
    const lines = bulkData.split("\n");
    let count = 0;

    try {
      for (const line of lines) {
        const [name, phone, dob, gender, dept] = line.split(",").map(s => s?.trim());
        if (!name || !dob) continue;

        const newDocRef = doc(membersRef);
        batch.set(newDocRef, {
          name,
          phone: phone || "",
          dateOfBirth: dob,
          birthdayKey: calculateBirthdayKey(dob),
          gender: gender || "Male",
          department: dept || "General",
          status: "Active",
          joined: new Date().toISOString().split('T')[0],
          createdAt: serverTimestamp(),
          photo: `https://picsum.photos/seed/${Math.random()}/100/100`
        });
        count++;
      }

      await batch.commit();
      toast({ title: "Import successful", description: `${count} members added to directory.` });
      setBulkData("");
      setIsBulkImportOpen(false);
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredMembers = useMemo(() => {
    return (members || []).filter(m => {
      const matchesSearch = (m.name?.toLowerCase().includes(searchTerm.toLowerCase()) || m.department?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusTab === "all" || m.status?.toLowerCase() === statusTab.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [members, searchTerm, statusTab]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Members</h2>
          <p className="text-muted-foreground">Managing directory for {currentChurch?.name || "your ministry"}.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none glass border-white/10" onClick={() => setIsBulkImportOpen(true)}>
            <FileUp className="mr-2 h-4 w-4" /> Bulk Import
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild><Button className="flex-1 md:flex-none bg-primary" disabled={!currentChurch}><Plus className="mr-2 h-4 w-4" /> Add Member</Button></DialogTrigger>
            <DialogContent className="glass max-w-2xl">
              <DialogHeader><DialogTitle>Add New Member</DialogTitle><DialogDescription>Birth dates must be YYYY-MM-DD for automation to function.</DialogDescription></DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Full Name</Label><Input value={newMember.name} onChange={(e) => setNewMember({...newMember, name: e.target.value})} placeholder="John Doe" /></div>
                  <div className="space-y-2"><Label>Gender</Label><Select value={newMember.gender} onValueChange={(v: any) => setNewMember({...newMember, gender: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Phone</Label><Input value={newMember.phone} onChange={(e) => setNewMember({...newMember, phone: e.target.value})} placeholder="0240000000" /></div>
                  <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={newMember.dateOfBirth} onChange={(e) => setNewMember({...newMember, dateOfBirth: e.target.value})} /></div>
                </div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button><Button onClick={handleAddMember}>Save Member</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="all" value={statusTab} onValueChange={setStatusTab} className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <TabsList className="glass border-white/10 p-1 rounded-2xl">
            <TabsTrigger value="all" className="rounded-xl px-6">All Members</TabsTrigger>
            <TabsTrigger value="active" className="rounded-xl px-6">Active</TabsTrigger>
          </TabsList>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search directory..." className="pl-10 rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="glass rounded-2xl overflow-hidden border border-white/5">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow>
                  <TableHead className="w-[80px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} className="hover:bg-white/5 border-white/5 transition-colors">
                    <TableCell><Avatar className="h-10 w-10 border border-white/10"><AvatarImage src={member.photo} /><AvatarFallback>{member.name?.charAt(0)}</AvatarFallback></Avatar></TableCell>
                    <TableCell><div className="font-semibold">{member.name}</div><div className="text-[10px] text-muted-foreground">{member.phone}</div></TableCell>
                    <TableCell className="text-xs font-mono">{member.dateOfBirth}</TableCell>
                    <TableCell><Badge variant="secondary" className="bg-primary/10 text-primary border-0">{member.department}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={cn("capitalize", member.status === 'Active' ? 'text-accent border-accent/20' : 'text-muted-foreground')}>{member.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass min-w-40">
                          <DropdownMenuItem onClick={() => { setEditingMember(member); setIsEditDialogOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Edit Profile</DropdownMenuItem>
                          <DropdownMenuSeparator className="border-white/5" />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setMemberToDelete(member)}><Trash2 className="mr-2 h-4 w-4" /> Delete Record</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                       <UsersIcon className="w-12 h-12 mx-auto mb-4 opacity-10" />
                       No members found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Tabs>

      {/* Edit Member Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="glass max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Member Profile</DialogTitle>
            <DialogDescription>Update record for {editingMember?.name}</DialogDescription>
          </DialogHeader>
          {editingMember && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Full Name</Label><Input value={editingMember.name} onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Gender</Label><Select value={editingMember.gender} onValueChange={(v: any) => setEditingMember({...editingMember, gender: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={editingMember.phone} onChange={(e) => setEditingMember({...editingMember, phone: e.target.value})} /></div>
                <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={editingMember.dateOfBirth} onChange={(e) => setEditingMember({...editingMember, dateOfBirth: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={editingMember.department} onValueChange={(v) => setEditingMember({...editingMember, department: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editingMember.status} onValueChange={(v) => setEditingMember({...editingMember, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Probation">Probation</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateMember}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!memberToDelete} onOpenChange={(o) => !o && setMemberToDelete(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive h-5 w-5" /> Serious Action Required</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{memberToDelete?.name}</strong> from the ministry directory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/80" onClick={handleDeleteMember}>Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Import Dialog */}
      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="glass max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileUp className="w-5 h-5 text-primary" /> Bulk Directory Import</DialogTitle>
            <DialogDescription>Paste your comma-separated member list below. Format: <strong>Name, Phone, DOB (YYYY-MM-DD), Gender, Department</strong></DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Textarea 
              placeholder="Ama Mensah, 0240000000, 1995-05-21, Female, Music" 
              className="min-h-[300px] font-mono text-xs bg-muted/20"
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
            />
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
               <Download className="w-5 h-5 text-primary mt-1" />
               <div className="text-xs space-y-1">
                 <p className="font-bold text-primary">Formatting Tip</p>
                 <p className="text-muted-foreground">Each line represents one member. Ensure dates are in YYYY-MM-DD format to enable automated birthday greetings.</p>
               </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkImportOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkImport} disabled={isImporting || !bulkData}>
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Import Members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
