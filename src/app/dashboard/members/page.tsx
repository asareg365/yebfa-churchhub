
"use client";

import { useState, useMemo, useRef } from "react";
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
  Download,
  ChevronDown,
  Layers,
  Camera,
  Upload,
  Info
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, deleteDoc, query, where, limit, writeBatch, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

const DEPARTMENTS = ["Music", "Youth", "Media", "Children", "Welfare", "Ushering", "Evangelism"];
const STANDARD_SOCIETIES = [
  "Knights of Columbus",
  "Catholic Women Association",
  "Catholic Youth Organization",
  "Sacred Heart of Jesus",
  "St. Vincent de Paul",
  "Legion of Mary",
  "Charismatic Renewal",
  "Christian Mothers",
  "Men's Fellowship",
  "Women's Fellowship"
];

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

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
  const [customSocietyInput, setCustomSocietyInput] = useState("");

  const addFileInputRef = useRef<HTMLInputElement>(null);
  const addCaptureInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editCaptureInputRef = useRef<HTMLInputElement>(null);

  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const churchQuery = useMemo(() => {
    if (!user?.email || !db) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];
  const membersRef = useMemo(() => currentChurch?.id ? collection(db, "churches", currentChurch.id, "members") : null, [db, currentChurch?.id]);
  const { data: members, loading } = useCollection(membersRef);

  const isCatholic = currentChurch?.denomination === 'Catholic';

  const [newMember, setNewMember] = useState({
    name: "",
    department: "Music",
    status: "Active" as const,
    gender: "Male" as const,
    dateOfBirth: "",
    phone: "",
    photo: "",
    societies: [] as string[]
  });

  const calculateBirthdayKey = (dobString: string) => {
    if (!dobString) return "";
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return "";
    const month = String(dob.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dob.getUTCDate()).padStart(2, '0');
    return `${month}${day}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (isEdit) {
          setEditingMember({ ...editingMember, photo: base64String });
        } else {
          setNewMember({ ...newMember, photo: base64String });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleSociety = (society: string, isEdit: boolean) => {
    if (isEdit) {
      const current = editingMember.societies || [];
      const updated = current.includes(society) 
        ? current.filter((s: string) => s !== society) 
        : [...current, society];
      setEditingMember({ ...editingMember, societies: updated });
    } else {
      const current = newMember.societies || [];
      const updated = current.includes(society) 
        ? current.filter((s: string) => s !== society) 
        : [...current, society];
      setNewMember({ ...newMember, societies: updated });
    }
  };

  const handleAddCustomSociety = (isEdit: boolean) => {
    const val = customSocietyInput.trim();
    if (!val) return;
    toggleSociety(val, isEdit);
    setCustomSocietyInput("");
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
      createdAt: serverTimestamp()
    };
    try {
      await addDoc(membersRef, memberData);
      setIsAddDialogOpen(false);
      setNewMember({ name: "", department: "Music", status: "Active", gender: "Male", dateOfBirth: "", phone: "", photo: "", societies: [] });
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
        phone: editingMember.phone || "",
        gender: editingMember.gender,
        department: editingMember.department,
        status: editingMember.status,
        dateOfBirth: editingMember.dateOfBirth || "",
        photo: editingMember.photo || "",
        birthdayKey: calculateBirthdayKey(editingMember.dateOfBirth || ""),
        societies: editingMember.societies || [],
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
    if (!bulkData.trim() || !membersRef || !db) return;
    setIsImporting(true);

    try {
      const lines = bulkData.split(/\r?\n/).filter(l => l.trim().length > 0);
      const batch = writeBatch(db);
      let count = 0;
      let skipped = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(/\t|,/).map(p => p.trim().replace(/^["'](.+)["']$/, '$1'));
        
        if (parts.length < 2) {
          skipped++;
          continue;
        }

        const [name, phone, dob, gender, dept] = parts;

        if (i === 0 && name.toLowerCase().includes("name")) continue;

        if (!name) {
          skipped++;
          continue;
        }

        const memberData = {
          name,
          phone: phone || "",
          dateOfBirth: dob || "",
          gender: (gender?.toLowerCase().startsWith("f") ? "Female" : "Male") as any,
          department: dept || "Music",
          status: "Active",
          birthdayKey: calculateBirthdayKey(dob || ""),
          joined: new Date().toISOString().split('T')[0],
          createdAt: serverTimestamp(),
          societies: []
        };

        const newDocRef = doc(membersRef);
        batch.set(newDocRef, memberData);
        count++;

        if (count >= 500) break;
      }

      await batch.commit();
      toast({ title: "Import Successful", description: `${count} members added. ${skipped > 0 ? skipped + ' rows skipped.' : ''}` });
      setBulkData("");
      setIsBulkImportOpen(false);
    } catch (error: any) {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredMembers = useMemo(() => {
    return (Array.isArray(members) ? members : []).filter(m => {
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
          <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 md:flex-none glass border-white/10">
                <FileUp className="mr-2 h-4 w-4" /> Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent className="glass max-w-xl">
              <DialogHeader>
                <DialogTitle>Excel / Spreadsheet Import</DialogTitle>
                <DialogDescription>Copy rows from Excel or Google Sheets and paste below. (Name, Phone, DOB, Gender, Dept)</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <Textarea 
                  placeholder="John Doe	0240000000	1990-05-15	Male	Music" 
                  className="min-h-[250px] font-mono text-xs bg-muted/20"
                  value={bulkData}
                  onChange={e => setBulkData(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBulkImportOpen(false)}>Cancel</Button>
                <Button onClick={handleBulkImport} disabled={isImporting || !bulkData.trim()}>
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Process Rows"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild><Button className="flex-1 md:flex-none bg-primary" disabled={!currentChurch}><Plus className="mr-2 h-4 w-4" /> Add Member</Button></DialogTrigger>
            <DialogContent className="glass max-w-2xl">
              <DialogHeader><DialogTitle>Add New Member</DialogTitle><DialogDescription>Enter member details or take a quick photo.</DialogDescription></DialogHeader>
              <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-xl">
                    <AvatarImage src={newMember.photo} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-3xl">{getInitials(newMember.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><Camera className="w-3 h-3" /> Member Photo</Label>
                    <div className="flex gap-2">
                       <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl" onClick={() => addCaptureInputRef.current?.click()}><Camera className="w-4 h-4 text-primary" /> Camera</Button>
                       <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl" onClick={() => addFileInputRef.current?.click()}><Upload className="w-4 h-4 text-accent" /> Gallery</Button>
                    </div>
                    <input type="file" ref={addCaptureInputRef} accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, false)} />
                    <input type="file" ref={addFileInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, false)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Full Name</Label><Input value={newMember.name} onChange={(e) => setNewMember({...newMember, name: e.target.value})} placeholder="John Doe" /></div>
                  <div className="space-y-2"><Label>Gender</Label><Select value={newMember.gender} onValueChange={(v: any) => setNewMember({...newMember, gender: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Phone</Label><Input value={newMember.phone} onChange={(e) => setNewMember({...newMember, phone: e.target.value})} placeholder="0240000000" /></div>
                  <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={newMember.dateOfBirth} onChange={(e) => setNewMember({...newMember, dateOfBirth: e.target.value})} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={newMember.department} onValueChange={(v) => setNewMember({...newMember, department: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {isCatholic && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      Societies & Groups
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between bg-muted/20 border-border h-11 text-left font-normal">
                          <span className="truncate">
                            {newMember.societies.length > 0 ? `${newMember.societies.length} Selected` : "Select Societies"}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 glass overflow-hidden" align="start">
                        <ScrollArea className="h-64">
                          <div className="p-2 space-y-1">
                            {STANDARD_SOCIETIES.map(society => {
                              const isSelected = newMember.societies.includes(society);
                              return (
                                <button 
                                  key={society} 
                                  onClick={() => toggleSociety(society, false)}
                                  className={cn("w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors", isSelected ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted/50")}
                                >
                                  <div className={cn("w-4 h-4 border rounded flex items-center justify-center", isSelected ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                  <span className="text-sm">{society}</span>
                                </button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                        <div className="p-3 border-t border-border bg-muted/30 space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Add Other Society</Label>
                          <div className="flex gap-2">
                            <Input placeholder="Enter name" value={customSocietyInput} onChange={e => setCustomSocietyInput(e.target.value)} className="h-9 text-sm" />
                            <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => handleAddCustomSociety(false)}><Plus className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newMember.societies.map(s => (
                        <Badge key={s} variant="secondary" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1">
                          {s} <Trash2 className="w-3 h-3 cursor-pointer opacity-50 hover:opacity-100" onClick={() => toggleSociety(s, false)} />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
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
          <div className="relative w-full md:max-sm">
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
                  <TableHead>Member Info</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} className="hover:bg-white/5 border-white/5 transition-colors">
                    <TableCell>
                      <Avatar className="h-10 w-10 border border-white/10 shadow-sm">
                        <AvatarImage src={member.photo} />
                        <AvatarFallback className="bg-muted text-muted-foreground font-bold text-xs">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold">{member.name}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <span>{member.phone}</span>
                        <span>•</span>
                        <span>{member.dateOfBirth}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="bg-primary/10 text-primary border-0">{member.department}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={cn("capitalize text-[10px]", member.status === 'Active' ? 'text-accent border-accent/20' : 'text-muted-foreground')}>{member.status}</Badge></TableCell>
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
              </TableBody>
            </Table>
          )}
        </div>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="glass max-w-2xl">
          <DialogHeader><DialogTitle>Edit Member Profile</DialogTitle><DialogDescription>Update details for {editingMember?.name}.</DialogDescription></DialogHeader>
          {editingMember && (
            <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-xl">
                  <AvatarImage src={editingMember.photo} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-3xl">{getInitials(editingMember.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><Camera className="w-3 h-3" /> Member Photo</Label>
                  <div className="flex gap-2">
                     <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl" onClick={() => editCaptureInputRef.current?.click()}><Camera className="w-4 h-4 text-primary" /> Camera</Button>
                     <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl" onClick={() => editFileInputRef.current?.click()}><Upload className="w-4 h-4 text-accent" /> Gallery</Button>
                  </div>
                  <input type="file" ref={editCaptureInputRef} accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, true)} />
                  <input type="file" ref={editFileInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, true)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Full Name</Label><Input value={editingMember.name} onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Status</Label><Select value={editingMember.status} onValueChange={(v: any) => setEditingMember({...editingMember, status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Probation">Probation</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Phone</Label><Input value={editingMember.phone} onChange={(e) => setEditingMember({...editingMember, phone: e.target.value})} /></div>
                <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={editingMember.dateOfBirth} onChange={(e) => setEditingMember({...editingMember, dateOfBirth: e.target.value})} /></div>
              </div>
              <div className="space-y-2"><Label>Department</Label><Select value={editingMember.department} onValueChange={(v: any) => setEditingMember({...editingMember, department: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>

              {isCatholic && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    Societies & Groups
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between bg-muted/20 border-border h-11 text-left font-normal">
                        <span className="truncate">
                          {(editingMember.societies || []).length > 0 ? `${editingMember.societies.length} Selected` : "Select Societies"}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 glass overflow-hidden" align="start">
                      <ScrollArea className="h-64">
                        <div className="p-2 space-y-1">
                          {STANDARD_SOCIETIES.map(society => {
                            const isSelected = (editingMember.societies || []).includes(society);
                            return (
                              <button 
                                key={society} 
                                onClick={() => toggleSociety(society, true)}
                                className={cn("w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors", isSelected ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted/50")}
                              >
                                <div className={cn("w-4 h-4 border rounded flex items-center justify-center", isSelected ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <span className="text-sm">{society}</span>
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                      <div className="p-3 border-t border-border bg-muted/30 space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Add Other Society</Label>
                        <div className="flex gap-2">
                          <Input placeholder="Enter name" value={customSocietyInput} onChange={e => setCustomSocietyInput(e.target.value)} className="h-9 text-sm" />
                          <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => handleAddCustomSociety(true)}><Plus className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(editingMember.societies || []).map(s => (
                      <Badge key={s} variant="secondary" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1">
                        {s} <Trash2 className="w-3 h-3 cursor-pointer opacity-50 hover:opacity-100" onClick={() => toggleSociety(s, true)} />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button><Button onClick={handleUpdateMember}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!memberToDelete} onOpenChange={(o) => !o && setMemberToDelete(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive h-5 w-5" /> Serious Action Required</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove <strong>{memberToDelete?.name}</strong>. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/80" onClick={handleDeleteMember}>Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
