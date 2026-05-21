"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Download, MoreVertical, QrCode, Mail, Phone, Loader2, Users as UsersIcon, Trash2, FileUp, CheckCircle2, AlertCircle, ChevronDown, Check } from "lucide-react";
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
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, deleteDoc, query, where, limit, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const CATHOLIC_SOCIETIES = [
  "Knights of Columbus",
  "Catholic Women Association",
  "Catholic Youth Organization",
  "Sacred Heart of Jesus",
  "St. Vincent de Paul",
  "Legion of Mary",
  "Charismatic Renewal",
  "Christian Mothers"
];

const DEPARTMENTS = [
  "Music",
  "Youth",
  "Media",
  "Children",
  "Welfare",
  "Ushering",
  "Evangelism"
];

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkData, setBulkData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<any>(null);
  const [otherSocietyInput, setOtherSocietyInput] = useState("");

  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    const email = user.email.toLowerCase().trim();
    return query(collection(db, "churches"), where("adminEmails", "array-contains", email), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const isCatholic = currentChurch?.denomination === 'Catholic';

  const membersRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, "churches", currentChurch.id, "members");
  }, [db, currentChurch?.id]);

  const { data: members, loading } = useCollection(membersRef);

  const [newMember, setNewMember] = useState({
    name: "",
    department: "Music",
    status: "Active" as const,
    gender: "Male" as const,
    dateOfBirth: "",
    phone: "",
    societies: [] as string[]
  });

  const toggleSociety = (society: string) => {
    setNewMember(prev => ({
      ...prev,
      societies: prev.societies.includes(society)
        ? prev.societies.filter(s => s !== society)
        : [...prev.societies, society]
    }));
  };

  const handleAddCustomSociety = () => {
    const val = otherSocietyInput.trim();
    if (!val) return;
    if (!newMember.societies.includes(val)) {
      setNewMember(prev => ({
        ...prev,
        societies: [...prev.societies, val]
      }));
    }
    setOtherSocietyInput("");
  };

  const handleAddMember = () => {
    if (!newMember.name || !newMember.dateOfBirth || !membersRef) {
      toast({ title: "Validation Error", description: "Name and Date of Birth are required.", variant: "destructive" });
      return;
    }
    
    const memberData = {
      ...newMember,
      joined: new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp(),
      photo: `https://picsum.photos/seed/${Math.random()}/100/100`
    };

    addDoc(membersRef, memberData)
      .then(() => {
        setIsAddDialogOpen(false);
        setNewMember({ name: "", department: "Music", status: "Active", gender: "Male", dateOfBirth: "", phone: "", societies: [] });
        toast({ title: "Member added successfully" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: membersRef.path,
          operation: 'create',
          requestResourceData: memberData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleBulkImport = async () => {
    if (!bulkData || !membersRef) return;
    setIsImporting(true);

    try {
      const lines = bulkData.trim().split("\n");
      const batch = writeBatch(db);
      let count = 0;

      for (const line of lines) {
        const [name, phone, dob, department, gender] = line.split(",").map(s => s?.trim());
        if (!name || !dob) continue;

        const docRef = doc(membersRef);
        batch.set(docRef, {
          name,
          phone: phone || "",
          dateOfBirth: dob, // Expected YYYY-MM-DD
          department: department || "Music",
          gender: (gender as any) || "Male",
          status: "Active",
          societies: [],
          joined: new Date().toISOString().split('T')[0],
          createdAt: serverTimestamp(),
          photo: `https://picsum.photos/seed/${Math.random()}/100/100`
        });
        count++;
      }

      await batch.commit();
      toast({ title: "Import Successful", description: `${count} members have been added.` });
      setBulkData("");
      setIsBulkImportOpen(false);
    } catch (error: any) {
      toast({ title: "Import Failed", description: "Please check your format and try again.", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteMember = () => {
    if (!memberToDelete || !membersRef) return;

    const docRef = doc(membersRef, memberToDelete.id);
    deleteDoc(docRef)
      .then(() => {
        setMemberToDelete(null);
        toast({ title: "Member removed from directory" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const filteredMembers = useMemo(() => {
    return (members || []).filter(m => {
      const matchesSearch = (m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.department?.toLowerCase().includes(searchTerm.toLowerCase()));
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
            <DialogTrigger asChild>
              <Button className="flex-1 md:flex-none bg-primary hover:bg-primary/80" disabled={!currentChurch}>
                <Plus className="mr-2 h-4 w-4" /> Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="glass max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
                <DialogDescription>Fill in the details to register a new congregant. Dates must be in YYYY-MM-DD format.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input 
                      value={newMember.name} 
                      onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                      placeholder="John Doe" 
                      className="bg-white/5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={newMember.gender} onValueChange={(v: any) => setNewMember({...newMember, gender: v})}>
                      <SelectTrigger className="bg-white/5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass">
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input 
                      value={newMember.phone} 
                      onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                      placeholder="0240000000" 
                      className="bg-white/5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input 
                      type="date"
                      value={newMember.dateOfBirth} 
                      onChange={(e) => setNewMember({...newMember, dateOfBirth: e.target.value})}
                      className="bg-white/5"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={newMember.department} onValueChange={(v) => setNewMember({...newMember, department: v})}>
                      <SelectTrigger className="bg-white/5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass">
                        {DEPARTMENTS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={newMember.status} onValueChange={(v: any) => setNewMember({...newMember, status: v})}>
                      <SelectTrigger className="bg-white/5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass">
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Probation">Probation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isCatholic && (
                  <div className="space-y-2">
                    <Label>Societies</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-between bg-white/5 border-white/10 h-11 px-3 text-left font-normal"
                        >
                          <span className="truncate">
                            {newMember.societies.length > 0 
                              ? `${newMember.societies.length} Selected`
                              : "Select Societies"}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-[var(--radix-popover-trigger-width)] p-0 glass overflow-hidden" 
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <div className="flex flex-col" onPointerDown={(e) => e.stopPropagation()}>
                          <ScrollArea className="h-64">
                            <div className="p-2 space-y-1">
                              {/* Standard List */}
                              {CATHOLIC_SOCIETIES.map(society => {
                                const isSelected = newMember.societies.includes(society);
                                return (
                                  <button 
                                    key={society}
                                    type="button"
                                    className={cn(
                                      "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors outline-none",
                                      isSelected ? "bg-primary/20 text-primary font-bold" : "hover:bg-white/5"
                                    )}
                                    onClick={() => toggleSociety(society)}
                                  >
                                    <div className={cn(
                                      "w-4 h-4 border rounded flex items-center justify-center transition-colors shrink-0",
                                      isSelected ? "bg-primary border-primary" : "border-white/20"
                                    )}>
                                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                    <span className="text-sm">{society}</span>
                                  </button>
                                );
                              })}

                              {/* Custom Ones Already Selected */}
                              {newMember.societies.filter(s => !CATHOLIC_SOCIETIES.includes(s)).map(society => (
                                <button 
                                  key={society}
                                  type="button"
                                  className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-primary/20 text-primary font-bold text-left"
                                  onClick={() => toggleSociety(society)}
                                >
                                  <div className="w-4 h-4 border rounded border-primary bg-primary flex items-center justify-center shrink-0">
                                    <Check className="h-3 w-3 text-primary-foreground" />
                                  </div>
                                  <span className="text-sm">{society}</span>
                                </button>
                              ))}
                            </div>
                          </ScrollArea>

                          {/* Add Custom Input - Pinned at bottom */}
                          <div className="p-3 border-t border-white/10 bg-muted/20 space-y-2">
                             <Label className="text-[10px] uppercase font-bold text-muted-foreground">Add Other Society</Label>
                             <div className="flex gap-2">
                               <Input 
                                 placeholder="Enter name"
                                 value={otherSocietyInput}
                                 onChange={(e) => setOtherSocietyInput(e.target.value)}
                                 className="h-9 text-sm bg-white/10"
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter') {
                                     e.preventDefault();
                                     handleAddCustomSociety();
                                   }
                                 }}
                               />
                               <Button 
                                 type="button"
                                 size="icon" 
                                 className="h-9 w-9 shrink-0" 
                                 onClick={handleAddCustomSociety}
                               >
                                 <Plus className="h-4 w-4" />
                               </Button>
                             </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddMember}>Save Member</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="glass max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk Member Import</DialogTitle>
            <DialogDescription>Paste member data separated by commas (one per line). Format: Name, Phone, DOB (YYYY-MM-DD), Department, Gender</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              className="min-h-[200px] bg-white/5 font-mono text-xs" 
              placeholder="Example:
John Doe, 0240000000, 1990-05-15, Music, Male
Jane Smith, 0550000000, 1995-10-20, Youth, Female"
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkImportOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkImport} disabled={isImporting || !bulkData}>
              {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
              Start Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="all" value={statusTab} onValueChange={setStatusTab} className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <TabsList className="glass border-white/10 p-1 rounded-2xl">
            <TabsTrigger value="all" className="rounded-xl px-6">All Members</TabsTrigger>
            <TabsTrigger value="active" className="rounded-xl px-6">Active</TabsTrigger>
            <TabsTrigger value="inactive" className="rounded-xl px-6">Inactive</TabsTrigger>
          </TabsList>
          
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name..." 
              className="pl-10 bg-white/5 border-white/10 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value={statusTab} className="mt-0">
          <div className="glass rounded-2xl overflow-hidden border border-white/5">
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow>
                    <TableHead className="w-[80px]"></TableHead>
                    <TableHead>Member Name</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id} className="hover:bg-white/5 transition-colors border-white/5">
                      <TableCell>
                        <Avatar className="h-10 w-10 border border-primary/20">
                          <AvatarImage src={member.photo} />
                          <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{member.name}</div>
                        <div className="text-[10px] text-muted-foreground">{member.phone}</div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{member.dateOfBirth}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                          {member.department}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "capitalize",
                          member.status === 'Active' ? 'text-accent border-accent/20' : 'text-muted-foreground border-white/10'
                        )}>
                          {member.status}
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
                            <DropdownMenuItem className="cursor-pointer">
                              <QrCode className="mr-2 h-4 w-4" /> View QR ID
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setMemberToDelete(member)}>
                              <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredMembers.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <UsersIcon className="h-10 w-10 opacity-20" />
                          <p>No members found.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{memberToDelete?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMember}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
