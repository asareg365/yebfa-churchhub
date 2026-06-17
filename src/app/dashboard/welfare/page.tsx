
"use client";

import { useState, useMemo, useRef } from "react";
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Loader2, 
  HandHelping, 
  Trash2, 
  FileUp, 
  Check, 
  Pencil,
  AlertTriangle,
  Camera,
  Upload,
  Info,
  CheckCircle2,
  Clock,
  Ban
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

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default function WelfarePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkData, setBulkData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<any>(null);
  const [editingMember, setEditingMember] = useState<any>(null);

  const addCaptureInputRef = useRef<HTMLInputElement>(null);

  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const churchQuery = useMemo(() => {
    if (!user?.email || !db) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];
  const welfareRef = useMemo(() => currentChurch?.id ? collection(db, "churches", currentChurch.id, "welfare") : null, [db, currentChurch?.id]);
  const { data: welfareMembers, loading } = useCollection(welfareRef);

  const [newMember, setNewMember] = useState({
    name: "",
    status: "Active" as const,
    phone: "",
    needs: "",
    photo: ""
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMember({ ...newMember, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.name || !welfareRef) {
      toast({ title: "Incomplete data", description: "Name is required.", variant: "destructive" });
      return;
    }
    try {
      await addDoc(welfareRef, {
        ...newMember,
        createdAt: serverTimestamp()
      });
      setIsAddDialogOpen(false);
      setNewMember({ name: "", status: "Active", phone: "", needs: "", photo: "" });
      toast({ title: "Welfare record saved" });
    } catch (e) {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handleUpdateMember = async () => {
    if (!editingMember || !welfareRef) return;
    try {
      await updateDoc(doc(welfareRef, editingMember.id), {
        ...editingMember,
        updatedAt: serverTimestamp()
      });
      setIsEditDialogOpen(false);
      setEditingMember(null);
      toast({ title: "Record updated" });
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleBulkImport = async () => {
    if (!bulkData.trim() || !welfareRef || !db) return;
    setIsImporting(true);

    try {
      const lines = bulkData.split(/\r?\n/).filter(l => l.trim().length > 0);
      const batch = writeBatch(db);
      let count = 0;
      let skipped = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Tab (Excel) or Comma (CSV) support
        const parts = line.split(/\t|,/).map(p => p.trim().replace(/^["'](.+)["']$/, '$1'));
        
        if (parts.length < 2) {
          skipped++;
          continue;
        }

        const [name, phone, status, needs] = parts;

        // Skip header
        if (i === 0 && name.toLowerCase().includes("name")) continue;

        if (!name) {
          skipped++;
          continue;
        }

        batch.set(doc(welfareRef), {
          name,
          phone: phone || "",
          status: (status?.toLowerCase() === "inactive" ? "Inactive" : "Active"),
          needs: needs || "",
          createdAt: serverTimestamp()
        });
        count++;
        if (count >= 500) break;
      }

      await batch.commit();
      toast({ title: "Import Successful", description: `${count} welfare records added.` });
      setBulkData("");
      setIsBulkImportOpen(false);
    } catch (error: any) {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredMembers = useMemo(() => {
    return (Array.isArray(welfareMembers) ? welfareMembers : []).filter(m => {
      const matchesSearch = (m.name?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusTab === "all" || m.status?.toLowerCase() === statusTab.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [welfareMembers, searchTerm, statusTab]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Welfare Directory</h2>
          <p className="text-muted-foreground">Community support for {currentChurch?.name}.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 md:flex-none glass border-white/10">
                <FileUp className="mr-2 h-4 w-4" /> Bulk Excel Import
              </Button>
            </DialogTrigger>
            <DialogContent className="glass max-w-xl">
              <DialogHeader>
                <DialogTitle>Spreadsheet Bulk Import</DialogTitle>
                <DialogDescription>Paste rows from Excel. Columns: Name, Phone, Status (Active/Inactive), Needs</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <Textarea 
                  placeholder="John Mensah	0240000000	Active	Financial Aid" 
                  className="min-h-[250px] font-mono text-xs bg-muted/20"
                  value={bulkData}
                  onChange={e => setBulkData(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBulkImportOpen(false)}>Cancel</Button>
                <Button onClick={handleBulkImport} disabled={isImporting || !bulkData.trim()}>
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Process Excel Data"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 md:flex-none bg-primary">
                <HandHelping className="mr-2 h-4 w-4" /> Add Record
              </Button>
            </DialogTrigger>
            <DialogContent className="glass">
              <DialogHeader><DialogTitle>New Welfare Member</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                 <div className="flex items-center gap-4">
                   <Avatar className="h-16 w-16 border-border">
                     <AvatarImage src={newMember.photo} />
                     <AvatarFallback>{getInitials(newMember.name)}</AvatarFallback>
                   </Avatar>
                   <div className="flex-1 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => addCaptureInputRef.current?.click()}><Camera className="w-3 h-3 mr-1" /> Photo</Button>
                      <input type="file" ref={addCaptureInputRef} capture="environment" accept="image/*" className="hidden" onChange={handleFileChange} />
                   </div>
                 </div>
                 <div className="space-y-2"><Label>Full Name</Label><Input value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} /></div>
                 <div className="space-y-2"><Label>Phone</Label><Input value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} /></div>
                 <div className="space-y-2"><Label>Status</Label><Select value={newMember.status} onValueChange={(v: any) => setNewMember({...newMember, status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select></div>
                 <div className="space-y-2"><Label>Needs / Description</Label><Textarea value={newMember.needs} onChange={e => setNewMember({...newMember, needs: e.target.value})} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddMember}>Save Record</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={statusTab} onValueChange={setStatusTab} className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <TabsList className="glass border-white/10 p-1 rounded-2xl">
            <TabsTrigger value="all" className="rounded-xl px-6">All</TabsTrigger>
            <TabsTrigger value="active" className="rounded-xl px-6">Active</TabsTrigger>
            <TabsTrigger value="inactive" className="rounded-xl px-6">Inactive</TabsTrigger>
          </TabsList>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search records..." className="pl-10 rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                  <TableHead>Member</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Needs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} className="hover:bg-white/5 border-white/5 transition-colors">
                    <TableCell>
                      <Avatar className="h-10 w-10 border border-white/10">
                        <AvatarImage src={member.photo} />
                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell><div className="font-semibold">{member.name}</div></TableCell>
                    <TableCell><code className="text-xs">{member.phone}</code></TableCell>
                    <TableCell><div className="max-w-[200px] truncate text-xs text-muted-foreground">{member.needs || 'No notes'}</div></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] uppercase", member.status === 'Active' ? 'text-accent border-accent/20' : 'text-muted-foreground')}>
                        {member.status === 'Active' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Ban className="w-3 h-3 mr-1" />}
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass min-w-40">
                          <DropdownMenuItem onClick={() => { setEditingMember(member); setIsEditDialogOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Edit Record</DropdownMenuItem>
                          <DropdownMenuSeparator className="border-white/5" />
                          <DropdownMenuItem className="text-destructive" onClick={() => { setMemberToDelete(member); }}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
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
    </div>
  );
}
