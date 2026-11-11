
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  Info,
  CopyX,
  FileBadge,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/table";
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
import { useTenant } from "@/context/tenant-context";

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

const MARITAL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed", "Separated", "Other", "Prefer not to say"];
const EDUCATION_LEVEL_OPTIONS = [
  "No formal education", "Primary", "Junior High School", "Senior High School", 
  "Vocational/Technical", "Certificate", "Diploma", "Bachelor's Degree", 
  "Master's Degree", "Doctorate", "Other"
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
  const [mounted, setMounted] = useState(false);

  const addFileInputRef = useRef<HTMLInputElement>(null);
  const addCaptureInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editCaptureInputRef = useRef<HTMLInputElement>(null);

  const db = useFirestore();
  const { user } = useUser();
  const { currentChurch, loading: churchLoading } = useTenant();
  const { toast } = useToast();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const membersRef = useMemo(() => currentChurch?.id ? collection(db, "churches", currentChurch.id, "members") : null, [db, currentChurch?.id]);
  const { data: members, loading } = useCollection(membersRef);

  const isCatholic = currentChurch?.denomination === 'Catholic';
  const extendedEnabled = currentChurch?.settings?.extendedProfile?.enabled ?? false;

  const [newMember, setNewMember] = useState<any>({
    name: "",
    department: "Music",
    status: "Active",
    gender: "Male",
    dateOfBirth: "",
    phone: "",
    photo: "",
    societies: [],
    extendedProfile: {
      firstName: "",
      otherNames: "",
      lastName: "",
      placeOfBirth: "",
      maritalStatus: "Single",
      educationLevel: "Bachelor's Degree",
      baptism: { baptised: false, date: "" },
      confirmation: { confirmed: false, place: "", date: "" }
    }
  });

  const normalizePhone = (phone: string) => phone?.replace(/\D/g, "") || "";

  const checkDuplicate = (phone: string) => {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return (members || []).find(m => normalizePhone(m.phone) === normalized);
  };

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

  const calculateProfileStatus = (extended: any) => {
    if (!extendedEnabled) return null;
    if (!extended || !extended.firstName) return "Not Started";
    const requiredSet = ['firstName', 'lastName', 'placeOfBirth'];
    const filled = requiredSet.every(field => !!extended[field]);
    return filled ? "Complete" : "Incomplete";
  };

  const handleAddMember = async () => {
    if (!newMember.name && !newMember.extendedProfile.firstName) {
      toast({ title: "Incomplete data", description: "Name is required.", variant: "destructive" });
      return;
    }

    const duplicate = checkDuplicate(newMember.phone);
    if (duplicate) {
      toast({ 
        title: "Duplicate Member Found", 
        description: `A member named ${duplicate.name} already exists with phone ${newMember.phone}.`,
        variant: "destructive"
      });
      return;
    }

    // Auto-generate display name if structured fields are used
    let finalName = newMember.name;
    if (extendedEnabled && newMember.extendedProfile.firstName) {
      finalName = `${newMember.extendedProfile.firstName} ${newMember.extendedProfile.otherNames || ''} ${newMember.extendedProfile.lastName}`.replace(/\s+/g, ' ').trim();
    }

    const memberData = {
      ...newMember,
      name: finalName,
      profileStatus: calculateProfileStatus(newMember.extendedProfile),
      birthdayKey: calculateBirthdayKey(newMember.dateOfBirth),
      joined: new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(membersRef!, memberData);
      setIsAddDialogOpen(false);
      setNewMember({ 
        name: "", department: "Music", status: "Active", gender: "Male", dateOfBirth: "", phone: "", photo: "", societies: [],
        extendedProfile: { firstName: "", otherNames: "", lastName: "", placeOfBirth: "", maritalStatus: "Single", educationLevel: "Bachelor's Degree", baptism: { baptised: false, date: "" }, confirmation: { confirmed: false, place: "", date: "" } }
      });
      toast({ title: "Member added successfully" });
    } catch (e) {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handleUpdateMember = async () => {
    if (!editingMember || !membersRef) return;
    
    let finalName = editingMember.name;
    if (extendedEnabled && editingMember.extendedProfile?.firstName) {
      finalName = `${editingMember.extendedProfile.firstName} ${editingMember.extendedProfile.otherNames || ''} ${editingMember.extendedProfile.lastName}`.replace(/\s+/g, ' ').trim();
    }

    try {
      const docRef = doc(membersRef, editingMember.id);
      await updateDoc(docRef, {
        ...editingMember,
        name: finalName,
        profileStatus: calculateProfileStatus(editingMember.extendedProfile),
        birthdayKey: calculateBirthdayKey(editingMember.dateOfBirth || ""),
        updatedAt: serverTimestamp()
      });
      setIsEditDialogOpen(false);
      setEditingMember(null);
      toast({ title: "Profile updated" });
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const filteredMembers = useMemo(() => {
    return (Array.isArray(members) ? members : []).filter(m => {
      const matchesSearch = (m.name?.toLowerCase().includes(searchTerm.toLowerCase()) || m.department?.toLowerCase().includes(searchTerm.toLowerCase()));
      if (statusTab === "all") return matchesSearch;
      if (statusTab === "active") return matchesSearch && m.status === 'Active';
      if (statusTab === "incomplete") return matchesSearch && m.profileStatus !== 'Complete';
      return matchesSearch;
    });
  }, [members, searchTerm, statusTab]);

  if (!mounted || churchLoading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Members</h2>
          <p className="text-muted-foreground">Managing directory for {currentChurch?.name || "your ministry"}.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild><Button className="flex-1 md:flex-none bg-primary" disabled={!currentChurch}><Plus className="mr-2 h-4 w-4" /> Add Member</Button></DialogTrigger>
            <DialogContent className="glass max-w-2xl">
              <DialogHeader><DialogTitle>Add New Member</DialogTitle><DialogDescription>Initialize record with core details.</DialogDescription></DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-8 py-4">
                  {/* Photo Section */}
                  <div className="flex items-center gap-6">
                    <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-xl">
                      <AvatarImage src={newMember.photo} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-3xl">{getInitials(newMember.name || newMember.extendedProfile.firstName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-3">
                      <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Camera className="w-3 h-3" /> Photo Identity</Label>
                      <div className="flex gap-2">
                         <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl" onClick={() => addCaptureInputRef.current?.click()}><Camera className="w-4 h-4 text-primary" /> Camera</Button>
                         <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl" onClick={() => addFileInputRef.current?.click()}><Upload className="w-4 h-4 text-accent" /> Gallery</Button>
                      </div>
                      <input type="file" ref={addCaptureInputRef} accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, false)} />
                      <input type="file" ref={addFileInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, false)} />
                    </div>
                  </div>

                  {/* Identification Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Layers className="w-4 h-4" />
                      <span className="text-sm font-bold uppercase tracking-widest">Identification</span>
                    </div>
                    {extendedEnabled ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2"><Label>First Name</Label><Input value={newMember.extendedProfile.firstName} onChange={(e) => setNewMember({...newMember, extendedProfile: {...newMember.extendedProfile, firstName: e.target.value}})} /></div>
                        <div className="space-y-2"><Label>Other Names</Label><Input value={newMember.extendedProfile.otherNames} onChange={(e) => setNewMember({...newMember, extendedProfile: {...newMember.extendedProfile, otherNames: e.target.value}})} /></div>
                        <div className="space-y-2"><Label>Last Name</Label><Input value={newMember.extendedProfile.lastName} onChange={(e) => setNewMember({...newMember, extendedProfile: {...newMember.extendedProfile, lastName: e.target.value}})} /></div>
                      </div>
                    ) : (
                      <div className="space-y-2"><Label>Full Name</Label><Input value={newMember.name} onChange={(e) => setNewMember({...newMember, name: e.target.value})} placeholder="e.g. John Doe" /></div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={newMember.phone} onChange={(e) => setNewMember({...newMember, phone: e.target.value})} placeholder="024XXXXXXX" />
                      </div>
                      <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={newMember.dateOfBirth} onChange={(e) => setNewMember({...newMember, dateOfBirth: e.target.value})} /></div>
                    </div>
                  </div>

                  {/* Extended Details (Conditional) */}
                  {extendedEnabled && (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-accent">
                          <UserCheck className="w-4 h-4" />
                          <span className="text-sm font-bold uppercase tracking-widest">Extended Profile</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>Place of Birth</Label><Input value={newMember.extendedProfile.placeOfBirth} onChange={(e) => setNewMember({...newMember, extendedProfile: {...newMember.extendedProfile, placeOfBirth: e.target.value}})} /></div>
                          <div className="space-y-2">
                            <Label>Marital Status</Label>
                            <Select value={newMember.extendedProfile.maritalStatus} onValueChange={(v) => setNewMember({...newMember, extendedProfile: {...newMember.extendedProfile, maritalStatus: v}})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{MARITAL_STATUS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Education Level</Label>
                          <Select value={newMember.extendedProfile.educationLevel} onValueChange={(v) => setNewMember({...newMember, extendedProfile: {...newMember.extendedProfile, educationLevel: v}})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{EDUCATION_LEVEL_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Baptism Section */}
                      <div className="p-4 rounded-xl bg-muted/20 border space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-sm">
                            <FileBadge className="w-4 h-4 text-primary" /> Baptism Information
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Baptised?</Label>
                            <Switch checked={newMember.extendedProfile.baptism.baptised} onCheckedChange={(v) => setNewMember({...newMember, extendedProfile: {...newMember.extendedProfile, baptism: {...newMember.extendedProfile.baptism, baptised: v}}})} />
                          </div>
                        </div>
                        {newMember.extendedProfile.baptism.baptised && (
                          <div className="animate-in fade-in slide-in-from-top-2">
                            <Label className="text-xs">Date of Baptism</Label>
                            <Input type="date" className="mt-1" value={newMember.extendedProfile.baptism.date} onChange={(e) => setNewMember({...newMember, extendedProfile: {...newMember.extendedProfile, baptism: {...newMember.extendedProfile.baptism, date: e.target.value}}})} />
                          </div>
                        )}
                      </div>

                      {/* Confirmation Section */}
                      <div className="p-4 rounded-xl bg-muted/20 border space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-sm">
                            <UserCheck className="w-4 h-4 text-accent" /> Confirmation Information
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Confirmed?</Label>
                            <Switch checked={newMember.extendedProfile.confirmation.confirmed} onCheckedChange={(v) => setNewMember({...newMember, extendedProfile: {...newMember.extendedProfile, confirmation: {...newMember.extendedProfile.confirmation, confirmed: v}}})} />
                          </div>
                        </div>
                        {newMember.extendedProfile.confirmation.confirmed && (
                          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Place of Confirmation</Label>
                              <Input value={newMember.extendedProfile.confirmation.place} onChange={(e) => setNewMember({...newMember, extendedProfile: {...newMember.extendedProfile, confirmation: {...newMember.extendedProfile.confirmation, place: e.target.value}}})} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Date of Confirmation</Label>
                              <Input type="date" value={newMember.extendedProfile.confirmation.date} onChange={(e) => setNewMember({...newMember, extendedProfile: {...newMember.extendedProfile, confirmation: {...newMember.extendedProfile.confirmation, date: e.target.value}}})} />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Department & Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select value={newMember.department} onValueChange={(v) => setNewMember({...newMember, department: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={newMember.status} onValueChange={(v: any) => setNewMember({...newMember, status: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter><Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button><Button onClick={handleAddMember}>Save Member</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="all" value={statusTab} onValueChange={setStatusTab} className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <TabsList className="glass border-white/10 p-1 rounded-2xl">
            <TabsTrigger value="all" className="rounded-xl px-6">Directory</TabsTrigger>
            <TabsTrigger value="active" className="rounded-xl px-6">Active</TabsTrigger>
            {extendedEnabled && (
              <TabsTrigger value="incomplete" className="rounded-xl px-6 flex items-center gap-2">
                <AlertCircle className="w-3 h-3 text-amber-500" />
                Incomplete Profiles
              </TabsTrigger>
            )}
          </TabsList>
          <div className="relative w-full md:max-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search name or dept..." className="pl-10 rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="glass rounded-2xl overflow-hidden border border-white/5">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>Member Info</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  {extendedEnabled && <TableHead>Extended Data</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} className="hover:bg-white/5 border-white/5 transition-colors group">
                    <TableCell>
                      <Avatar className="h-9 w-9 border border-white/10 shadow-sm">
                        <AvatarImage src={member.photo} />
                        <AvatarFallback className="bg-muted text-muted-foreground font-bold text-xs">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm">{member.name}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <span>{member.phone}</span>
                        <span>•</span>
                        <span>{member.dateOfBirth}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[10px]">{member.department}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={cn("capitalize text-[9px] font-bold", member.status === 'Active' ? 'text-accent border-accent/20' : 'text-muted-foreground')}>{member.status}</Badge></TableCell>
                    {extendedEnabled && (
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-bold flex items-center gap-1 w-fit",
                          member.profileStatus === 'Complete' ? "border-accent/40 text-accent bg-accent/5" : 
                          member.profileStatus === 'Incomplete' ? "border-amber-400/40 text-amber-600 bg-amber-50" : "border-muted text-muted-foreground"
                        )}>
                          {member.profileStatus === 'Complete' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                          {member.profileStatus || 'Not Started'}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass min-w-48">
                          <DropdownMenuItem onClick={() => { setEditingMember(member); setIsEditDialogOpen(true); }} className="font-bold">
                            <Pencil className="mr-2 h-4 w-4" /> Edit Profile
                          </DropdownMenuItem>
                          {extendedEnabled && member.profileStatus !== 'Complete' && (
                            <DropdownMenuItem onClick={() => { setEditingMember(member); setIsEditDialogOpen(true); }} className="text-amber-600 font-bold">
                              <FileBadge className="mr-2 h-4 w-4" /> Complete Information
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="border-white/5" />
                          <DropdownMenuItem className="text-destructive focus:text-white focus:bg-destructive" onClick={() => setMemberToDelete(member)}><Trash2 className="mr-2 h-4 w-4" /> Delete Record</DropdownMenuItem>
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

      {/* Edit Member Dialog (Includes Extended Info) */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="glass max-w-2xl">
          <DialogHeader><DialogTitle>Edit Member Profile</DialogTitle><DialogDescription>Update details for {editingMember?.name}.</DialogDescription></DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {editingMember && (
              <div className="space-y-8 py-4">
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-xl">
                    <AvatarImage src={editingMember.photo} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-3xl">{getInitials(editingMember.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-3">
                    <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Camera className="w-3 h-3" /> Identity Snapshot</Label>
                    <div className="flex gap-2">
                       <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl" onClick={() => editCaptureInputRef.current?.click()}><Camera className="w-4 h-4 text-primary" /> Camera</Button>
                       <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl" onClick={() => editFileInputRef.current?.click()}><Upload className="w-4 h-4 text-accent" /> Gallery</Button>
                    </div>
                    <input type="file" ref={editCaptureInputRef} accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, true)} />
                    <input type="file" ref={editFileInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, true)} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Layers className="w-4 h-4" />
                    <span className="text-sm font-bold uppercase tracking-widest">Identification</span>
                  </div>
                  {extendedEnabled ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2"><Label>First Name</Label><Input value={editingMember.extendedProfile?.firstName || ""} onChange={(e) => setEditingMember({...editingMember, extendedProfile: {...(editingMember.extendedProfile || {}), firstName: e.target.value}})} /></div>
                      <div className="space-y-2"><Label>Other Names</Label><Input value={editingMember.extendedProfile?.otherNames || ""} onChange={(e) => setEditingMember({...editingMember, extendedProfile: {...(editingMember.extendedProfile || {}), otherNames: e.target.value}})} /></div>
                      <div className="space-y-2"><Label>Last Name</Label><Input value={editingMember.extendedProfile?.lastName || ""} onChange={(e) => setEditingMember({...editingMember, extendedProfile: {...(editingMember.extendedProfile || {}), lastName: e.target.value}})} /></div>
                    </div>
                  ) : (
                    <div className="space-y-2"><Label>Full Name</Label><Input value={editingMember.name} onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} /></div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Phone</Label><Input value={editingMember.phone} onChange={(e) => setEditingMember({...editingMember, phone: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={editingMember.dateOfBirth} onChange={(e) => setEditingMember({...editingMember, dateOfBirth: e.target.value})} /></div>
                  </div>
                </div>

                {extendedEnabled && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-accent">
                        <UserCheck className="w-4 h-4" />
                        <span className="text-sm font-bold uppercase tracking-widest">Extended Profile</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Place of Birth</Label><Input value={editingMember.extendedProfile?.placeOfBirth || ""} onChange={(e) => setEditingMember({...editingMember, extendedProfile: {...(editingMember.extendedProfile || {}), placeOfBirth: e.target.value}})} /></div>
                        <div className="space-y-2">
                          <Label>Marital Status</Label>
                          <Select value={editingMember.extendedProfile?.maritalStatus || "Single"} onValueChange={(v) => setEditingMember({...editingMember, extendedProfile: {...(editingMember.extendedProfile || {}), maritalStatus: v}})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{MARITAL_STATUS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Education Level</Label>
                        <Select value={editingMember.extendedProfile?.educationLevel || "Bachelor's Degree"} onValueChange={(v) => setEditingMember({...editingMember, extendedProfile: {...(editingMember.extendedProfile || {}), educationLevel: v}})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{EDUCATION_LEVEL_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/20 border space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <FileBadge className="w-4 h-4 text-primary" /> Baptism Information
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Baptised?</Label>
                          <Switch checked={editingMember.extendedProfile?.baptism?.baptised || false} onCheckedChange={(v) => setEditingMember({...editingMember, extendedProfile: {...(editingMember.extendedProfile || {}), baptism: {...(editingMember.extendedProfile?.baptism || {}), baptised: v}}})} />
                        </div>
                      </div>
                      {editingMember.extendedProfile?.baptism?.baptised && (
                        <div>
                          <Label className="text-xs">Date of Baptism</Label>
                          <Input type="date" className="mt-1" value={editingMember.extendedProfile.baptism.date || ""} onChange={(e) => setEditingMember({...editingMember, extendedProfile: {...(editingMember.extendedProfile || {}), baptism: {...(editingMember.extendedProfile?.baptism || {}), date: e.target.value}}})} />
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-muted/20 border space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <UserCheck className="w-4 h-4 text-accent" /> Confirmation Information
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Confirmed?</Label>
                          <Switch checked={editingMember.extendedProfile?.confirmation?.confirmed || false} onCheckedChange={(v) => setEditingMember({...editingMember, extendedProfile: {...(editingMember.extendedProfile || {}), confirmation: {...(editingMember.extendedProfile?.confirmation || {}), confirmed: v}}})} />
                        </div>
                      </div>
                      {editingMember.extendedProfile?.confirmation?.confirmed && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Place of Confirmation</Label>
                            <Input value={editingMember.extendedProfile.confirmation.place || ""} onChange={(e) => setEditingMember({...editingMember, extendedProfile: {...(editingMember.extendedProfile || {}), confirmation: {...(editingMember.extendedProfile?.confirmation || {}), place: e.target.value}}})} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Date of Confirmation</Label>
                            <Input type="date" value={editingMember.extendedProfile.confirmation.date || ""} onChange={(e) => setEditingMember({...editingMember, extendedProfile: {...(editingMember.extendedProfile || {}), confirmation: {...(editingMember.extendedProfile?.confirmation || {}), date: e.target.value}}})} />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Department</Label><Select value={editingMember.department} onValueChange={(v) => setEditingMember({...editingMember, department: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Status</Label><Select value={editingMember.status} onValueChange={(v: any) => setEditingMember({...editingMember, status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select></div>
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter><Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button><Button onClick={handleUpdateMember}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!memberToDelete} onOpenChange={(o) => !o && setMemberToDelete(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive h-5 w-5" /> Permanent Deletion</AlertDialogTitle>
            <AlertDialogDescription>Remove <strong>{memberToDelete?.name}</strong> from the directory? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => { if (membersRef && memberToDelete) { deleteDoc(doc(membersRef, memberToDelete.id)); setMemberToDelete(null); toast({ title: "Member deleted" }); } }}>Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
