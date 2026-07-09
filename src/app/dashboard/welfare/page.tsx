
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  Ban,
  Wallet,
  Heart,
  FileText,
  Download,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  History,
  CopyX
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, deleteDoc, query, where, limit, writeBatch, updateDoc, increment, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  
  const [bulkData, setBulkData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  
  const [memberToDelete, setMemberToDelete] = useState<any>(null);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  const [newTransaction, setNewTransaction] = useState({
    type: "CONTRIBUTION" as "CONTRIBUTION" | "BENEFIT",
    amount: "",
    description: "",
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const addCaptureInputRef = useRef<HTMLInputElement>(null);

  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const churchQuery = useMemo(() => {
    if (!user?.email || !db) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];
  
  const welfareRef = useMemo(() => currentChurch?.id ? collection(db, "churches", currentChurch.id, "welfare") : null, [db, currentChurch?.id]);
  const { data: welfareMembers, loading } = useCollection(welfareRef);

  const transactionsRef = useMemo(() => {
    if (!currentChurch?.id || !selectedMember?.id) return null;
    return collection(db, "churches", currentChurch.id, "welfare", selectedMember.id, "transactions");
  }, [db, currentChurch?.id, selectedMember?.id]);

  const { data: transactions, loading: transactionsLoading } = useCollection(
    transactionsRef ? query(transactionsRef, orderBy("date", "desc"), limit(100)) : null
  );

  const [newMember, setNewMember] = useState({
    name: "",
    status: "Active" as const,
    phone: "",
    needs: "",
    photo: "",
    totalContributions: 0,
    totalBenefits: 0
  });

  const normalizePhone = (phone: string) => phone?.replace(/\D/g, "") || "";

  const checkDuplicate = (phone: string) => {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return (welfareMembers || []).find(m => normalizePhone(m.phone) === normalized);
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

  const handleAddMember = async () => {
    if (!newMember.name || !welfareRef) {
      toast({ title: "Incomplete data", description: "Name is required.", variant: "destructive" });
      return;
    }

    const duplicate = checkDuplicate(newMember.phone);
    if (duplicate) {
      toast({ 
        title: "Account Already Exists", 
        description: `A welfare account for ${duplicate.name} already exists with this phone number.`,
        variant: "destructive"
      });
      return;
    }

    try {
      await addDoc(welfareRef, {
        ...newMember,
        createdAt: serverTimestamp()
      });
      setIsAddDialogOpen(false);
      setNewMember({ name: "", status: "Active", phone: "", needs: "", photo: "", totalContributions: 0, totalBenefits: 0 });
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

  const handleRecordTransaction = async () => {
    if (!selectedMember || !newTransaction.amount || !transactionsRef || !welfareRef) return;
    setIsSavingTransaction(true);
    
    try {
      const amount = Number(newTransaction.amount);
      const batch = writeBatch(db);

      const txDocRef = doc(transactionsRef);
      batch.set(txDocRef, {
        ...newTransaction,
        amount,
        recordedBy: user?.email,
        createdAt: serverTimestamp()
      });

      const memberDocRef = doc(welfareRef, selectedMember.id);
      const incrementField = newTransaction.type === "CONTRIBUTION" ? "totalContributions" : "totalBenefits";
      batch.update(memberDocRef, {
        [incrementField]: increment(amount),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      
      toast({ title: "Transaction recorded", description: `${newTransaction.type} of GH₵${amount} for ${selectedMember.name}` });
      setIsTransactionDialogOpen(false);
      setNewTransaction({ type: "CONTRIBUTION", amount: "", description: "", date: format(new Date(), 'yyyy-MM-dd') });
    } catch (error: any) {
      toast({ title: "Operation failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingTransaction(false);
    }
  };

  const handleExportStatement = () => {
    if (!transactions?.length || !selectedMember) return;
    
    const headers = ["Date", "Type", "Description", "Amount (GH₵)"];
    const rows = transactions.map(tx => [
      tx.date,
      tx.type,
      `"${(tx.description || "").replace(/"/g, '""')}"`,
      tx.amount
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Welfare_Statement_${selectedMember.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Statement exported", description: "CSV file generated successfully." });
  };

  const handleBulkImport = async () => {
    if (!bulkData.trim() || !welfareRef || !db) return;
    setIsImporting(true);

    try {
      const lines = bulkData.split(/\r?\n/).filter(l => l.trim().length > 0);
      const batch = writeBatch(db);
      let count = 0;
      let duplicates = 0;

      const existingPhones = new Set((welfareMembers || []).map(m => normalizePhone(m.phone)));

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(/\t|,/).map(p => p.trim().replace(/^["'](.+)["']$/, '$1'));
        
        if (parts.length < 2) continue;

        const [name, phone, status, needs] = parts;
        if (i === 0 && name.toLowerCase().includes("name")) continue;
        if (!name) continue;

        if (phone && existingPhones.has(normalizePhone(phone))) {
          duplicates++;
          continue;
        }

        batch.set(doc(welfareRef), {
          name,
          phone: phone || "",
          status: (status?.toLowerCase() === "inactive" ? "Inactive" : "Active"),
          needs: needs || "",
          totalContributions: 0,
          totalBenefits: 0,
          createdAt: serverTimestamp()
        });
        count++;
        if (count >= 500) break;
      }

      await batch.commit();
      toast({ 
        title: "Import Successful", 
        description: `${count} welfare accounts created. ${duplicates > 0 ? duplicates + ' duplicates skipped.' : ''}` 
      });
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

  if (!mounted) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1 text-foreground">Welfare Accounts</h2>
          <p className="text-muted-foreground">Transactional account system for member support and contributions.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={() => setIsBulkImportOpen(true)} className="flex-1 md:flex-none glass border-white/10 rounded-xl">
            <FileUp className="mr-2 h-4 w-4" /> Bulk Setup
          </Button>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 md:flex-none bg-primary shadow-lg shadow-primary/20 rounded-xl">
                <Plus className="mr-2 h-4 w-4" /> New Account
              </Button>
            </DialogTrigger>
            <DialogContent className="glass max-w-2xl">
              <DialogHeader><DialogTitle>Open Welfare Account</DialogTitle><DialogDescription>Initialize a new member in the welfare management system.</DialogDescription></DialogHeader>
              <div className="space-y-4 py-4">
                 <div className="flex items-center gap-4">
                   <Avatar className="h-20 w-20 border-border shadow-md">
                     <AvatarImage src={newMember.photo} />
                     <AvatarFallback>{getInitials(newMember.name)}</AvatarFallback>
                   </Avatar>
                   <div className="flex-1 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => addCaptureInputRef.current?.click()} className="flex-1 rounded-xl h-10"><Camera className="w-3 h-3 mr-1" /> Snapshot</Button>
                      <input type="file" ref={addCaptureInputRef} capture="environment" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, false)} />
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2"><Label>Account Name</Label><Input value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} placeholder="e.g. Samuel Osei" className="rounded-xl" /></div>
                   <div className="space-y-2">
                     <Label className="flex justify-between items-center">
                       Phone
                       {newMember.phone && checkDuplicate(newMember.phone) && (
                         <span className="text-[10px] text-destructive flex items-center gap-1 font-bold animate-pulse">
                           <CopyX className="w-3 h-3" /> Duplicate Detected
                         </span>
                       )}
                     </Label>
                     <Input value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} placeholder="024XXXXXXX" className={cn("rounded-xl", newMember.phone && checkDuplicate(newMember.phone) && "border-destructive/50 bg-destructive/5")} />
                   </div>
                 </div>
                 <div className="space-y-2"><Label>Account Status</Label><Select value={newMember.status} onValueChange={(v: any) => setNewMember({...newMember, status: v})}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active Support</SelectItem><SelectItem value="Inactive">Inactive / On-Hold</SelectItem></SelectContent></Select></div>
                 <div className="space-y-2"><Label>Support Needs / Background</Label><Textarea value={newMember.needs} onChange={e => setNewMember({...newMember, needs: e.target.value})} placeholder="Describe the member's current standing or specific needs..." className="rounded-xl h-24" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl">Cancel</Button>
                <Button onClick={handleAddMember} className="bg-primary rounded-xl">Initialize Account</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="glass border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Accounts</p>
                <h3 className="text-xl md:text-2xl font-bold mt-1">{welfareMembers?.filter(m => m.status === 'Active').length || 0}</h3>
              </div>
              <HandHelping className="w-4 h-4 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-accent/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Pooled</p>
                <h3 className="text-xl md:text-2xl font-bold text-accent mt-1">GH₵{welfareMembers?.reduce((acc, curr) => acc + (curr.totalContributions || 0), 0).toLocaleString()}</h3>
              </div>
              <Wallet className="w-4 h-4 text-accent" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Support Disbursed</p>
                <h3 className="text-xl md:text-2xl font-bold text-destructive mt-1">GH₵{welfareMembers?.reduce((acc, curr) => acc + (curr.totalBenefits || 0), 0).toLocaleString()}</h3>
              </div>
              <Heart className="w-4 h-4 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={statusTab} onValueChange={setStatusTab} className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full overflow-x-auto hide-scrollbar">
            <TabsList className="glass border-white/10 p-1 rounded-2xl w-fit inline-flex">
              <TabsTrigger value="all" className="rounded-xl px-6">Global Directory</TabsTrigger>
              <TabsTrigger value="active" className="rounded-xl px-6">Active Only</TabsTrigger>
            </TabsList>
          </div>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search account name..." className="pl-10 rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="glass rounded-2xl overflow-hidden border border-white/5">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-white/5">
                    <TableHead className="w-[80px]"></TableHead>
                    <TableHead>Account Holder</TableHead>
                    <TableHead>Ledger Summary</TableHead>
                    <TableHead>Net Standing</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => {
                    const netStanding = (member.totalContributions || 0) - (member.totalBenefits || 0);
                    return (
                      <TableRow key={member.id} className="hover:bg-white/5 border-white/5 transition-colors group">
                        <TableCell>
                          <Avatar className="h-10 w-10 border border-white/10 shadow-sm">
                            <AvatarImage src={member.photo} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{getInitials(member.name)}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-foreground text-sm whitespace-nowrap">{member.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{member.phone}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3 text-[10px] md:text-xs">
                            <div className="flex items-center gap-1.5">
                              <TrendingUp className="w-3 h-3 text-accent" />
                              <span className="font-bold whitespace-nowrap">GH₵{(member.totalContributions || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <TrendingDown className="w-3 h-3 text-destructive" />
                              <span className="font-bold whitespace-nowrap">GH₵{(member.totalBenefits || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "font-mono font-bold text-[10px] whitespace-nowrap",
                            netStanding >= 0 ? "border-accent/20 text-accent bg-accent/5" : "border-destructive/20 text-destructive bg-destructive/5"
                          )}>
                            GH₵{netStanding.toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[9px] md:text-[10px] uppercase font-bold px-2 py-0.5 whitespace-nowrap", member.status === 'Active' ? 'text-accent border-accent/20' : 'text-muted-foreground')}>
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="group-hover:bg-white/10 rounded-lg"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass min-w-56">
                              <DropdownMenuItem onClick={() => { setSelectedMember(member); setIsStatementDialogOpen(true); }} className="font-bold text-primary">
                                <FileText className="mr-2 h-4 w-4" /> View Account Statement
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedMember(member); setIsTransactionDialogOpen(true); }}>
                                <Plus className="mr-2 h-4 w-4 text-accent" /> Record Transaction
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="border-white/10" />
                              <DropdownMenuItem onClick={() => { setEditingMember(member); setIsEditDialogOpen(true); }}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit Account Info
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="border-white/10" />
                              <DropdownMenuItem className="text-destructive focus:text-white focus:bg-destructive" onClick={() => setMemberToDelete(member)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Close Account
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredMembers.length === 0 && !loading && (
                     <TableRow>
                       <TableCell colSpan={6} className="py-24 text-center">
                          <div className="flex flex-col items-center gap-2 opacity-30">
                            <History className="w-12 h-12 mb-2" />
                            <p className="text-sm font-medium italic">No welfare accounts found.</p>
                          </div>
                       </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Tabs>

      {/* Account Statement Dialog */}
      <Dialog open={isStatementDialogOpen} onOpenChange={setIsStatementDialogOpen}>
        <DialogContent className="glass max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-muted/20 border-b">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-xl md:text-2xl font-bold">Account Statement</DialogTitle>
                <DialogDescription className="font-medium text-foreground text-xs md:text-sm">
                  Ledger details for <span className="text-primary font-bold">{selectedMember?.name}</span>
                </DialogDescription>
              </div>
              <Button onClick={handleExportStatement} variant="outline" className="rounded-xl h-10 border-primary/20 text-primary hover:bg-primary/5 shrink-0" disabled={!transactions?.length}>
                <Download className="mr-2 h-4 w-4" /> <span className="hidden md:inline">Export CSV</span>
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="grid grid-cols-3 gap-px bg-border border-b">
              <div className="bg-card p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Pooled</p>
                <p className="text-base md:text-xl font-bold text-accent">GH₵{(selectedMember?.totalContributions || 0).toLocaleString()}</p>
              </div>
              <div className="bg-card p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Disbursed</p>
                <p className="text-base md:text-xl font-bold text-destructive">GH₵{(selectedMember?.totalBenefits || 0).toLocaleString()}</p>
              </div>
              <div className="bg-card p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Balance</p>
                <p className="text-base md:text-xl font-bold text-primary">GH₵{((selectedMember?.totalContributions || 0) - (selectedMember?.totalBenefits || 0)).toLocaleString()}</p>
              </div>
            </div>
            
            <ScrollArea className="flex-1">
               {transactionsLoading ? (
                 <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
               ) : transactions && transactions.length > 0 ? (
                 <div className="overflow-x-auto">
                   <Table>
                     <TableHeader className="bg-muted/10 sticky top-0 z-10">
                       <TableRow>
                         <TableHead className="text-[10px] font-bold uppercase py-2">Date</TableHead>
                         <TableHead className="text-[10px] font-bold uppercase py-2">Type</TableHead>
                         <TableHead className="text-[10px] font-bold uppercase py-2">Description</TableHead>
                         <TableHead className="text-[10px] font-bold uppercase py-2 text-right">Amount (GH₵)</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {transactions.map((tx) => (
                         <TableRow key={tx.id} className="hover:bg-muted/5 border-white/5 transition-colors">
                           <TableCell className="text-[11px] md:text-xs font-medium whitespace-nowrap">{tx.date}</TableCell>
                           <TableCell>
                             <Badge variant="outline" className={cn(
                               "text-[9px] font-bold uppercase h-5 whitespace-nowrap",
                               tx.type === 'CONTRIBUTION' ? 'border-accent/30 text-accent' : 'border-destructive/30 text-destructive'
                             )}>
                               {tx.type}
                             </Badge>
                           </TableCell>
                           <TableCell className="text-[11px] md:text-xs text-muted-foreground max-w-[150px] md:max-w-xs truncate md:whitespace-normal">{tx.description || "N/A"}</TableCell>
                           <TableCell className={cn(
                             "text-xs md:text-sm font-bold text-right tabular-nums whitespace-nowrap",
                             tx.type === 'CONTRIBUTION' ? 'text-accent' : 'text-destructive'
                           )}>
                             {tx.type === 'CONTRIBUTION' ? '+' : '-'} {tx.amount.toLocaleString()}
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </div>
               ) : (
                 <div className="py-32 text-center opacity-30">
                    <FileText className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-bold">No ledger history available.</p>
                 </div>
               )}
            </ScrollArea>
          </div>
          <DialogFooter className="p-4 bg-muted/10 border-t">
            <Button variant="ghost" onClick={() => setIsStatementDialogOpen(false)} className="rounded-xl w-full h-11 font-bold">Close Statement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Record New Entry</DialogTitle>
            <DialogDescription>Add a transaction to <span className="font-bold text-foreground">{selectedMember?.name}</span>'s account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Transaction Category</Label>
               <div className="grid grid-cols-2 gap-2">
                 <Button 
                   type="button" 
                   variant={newTransaction.type === 'CONTRIBUTION' ? 'default' : 'outline'} 
                   className={cn("rounded-xl h-12", newTransaction.type === 'CONTRIBUTION' && "bg-accent hover:bg-accent/90")}
                   onClick={() => setNewTransaction({...newTransaction, type: 'CONTRIBUTION'})}
                 >
                   <TrendingUp className="w-4 h-4 mr-2" /> Contribution
                 </Button>
                 <Button 
                   type="button" 
                   variant={newTransaction.type === 'BENEFIT' ? 'default' : 'outline'} 
                   className={cn("rounded-xl h-12", newTransaction.type === 'BENEFIT' && "bg-destructive hover:bg-destructive/90")}
                   onClick={() => setNewTransaction({...newTransaction, type: 'BENEFIT'})}
                 >
                   <TrendingDown className="w-4 h-4 mr-2" /> Benefit
                 </Button>
               </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Amount (GH₵)</Label>
                 <Input 
                   type="number" 
                   value={newTransaction.amount} 
                   onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} 
                   placeholder="0.00" 
                   className="rounded-xl h-11"
                 />
               </div>
               <div className="space-y-2">
                 <Label>Effective Date</Label>
                 <Input 
                   type="date" 
                   value={newTransaction.date} 
                   onChange={e => setNewTransaction({...newTransaction, date: e.target.value})} 
                   className="rounded-xl h-11"
                 />
               </div>
             </div>
             <div className="space-y-2">
               <Label>Narrative / Description</Label>
               <Textarea 
                 value={newTransaction.description} 
                 onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} 
                 placeholder="Reason for contribution or specific benefit details..."
                 className="rounded-xl h-20"
               />
             </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsTransactionDialogOpen(false)} className="rounded-xl">Cancel</Button>
             <Button 
               onClick={handleRecordTransaction} 
               className={cn("rounded-xl h-10 px-8", newTransaction.type === 'CONTRIBUTION' ? "bg-accent" : "bg-destructive")}
               disabled={isSavingTransaction || !newTransaction.amount}
             >
               {isSavingTransaction ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <History className="w-4 h-4 mr-2" />}
               Commit Entry
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Welfare Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="glass max-w-2xl">
          <DialogHeader><DialogTitle>Account Profile Details</DialogTitle><DialogDescription>Update the master record for {editingMember?.name}.</DialogDescription></DialogHeader>
          {editingMember && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-border shadow-md">
                  <AvatarImage src={editingMember.photo} />
                  <AvatarFallback>{getInitials(editingMember.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                   <Button variant="outline" size="sm" onClick={() => addCaptureInputRef.current?.click()} className="flex-1 rounded-xl h-10"><Camera className="w-3 h-3 mr-1" /> Snapshot</Button>
                   <input type="file" ref={addCaptureInputRef} capture="environment" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, true)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Legal Name</Label><Input value={editingMember.name} onChange={e => setEditingMember({...editingMember, name: e.target.value})} className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Primary Phone</Label><Input value={editingMember.phone} onChange={e => setEditingMember({...editingMember, phone: e.target.value})} className="rounded-xl" /></div>
              </div>
              <div className="space-y-2"><Label>Current Status</Label><Select value={editingMember.status} onValueChange={(v: any) => setEditingMember({...editingMember, status: v})}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Welfare Notes</Label><Textarea value={editingMember.needs} onChange={e => setEditingMember({...editingMember, needs: e.target.value})} className="rounded-xl h-24" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleUpdateMember} className="bg-primary rounded-xl">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Setup Dialog */}
      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="glass max-w-xl">
          <DialogHeader>
            <DialogTitle>Mass Account Initialization</DialogTitle>
            <DialogDescription>Paste rows from Excel to open multiple accounts. Expected: Name, Phone, Status, Needs</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder="Samuel Osei	0240000000	Active	Senior Citizen Care" 
              className="min-h-[250px] font-mono text-xs bg-muted/20 rounded-xl"
              value={bulkData}
              onChange={e => setBulkData(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkImportOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleBulkImport} disabled={isImporting || !bulkData.trim()} className="bg-primary rounded-xl">
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileUp className="w-4 h-4 mr-2" />}
              Process Accounts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!memberToDelete} onOpenChange={(o) => !o && setMemberToDelete(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive h-5 w-5" /> Serious Action Required</AlertDialogTitle>
            <AlertDialogDescription>
              Closing <strong>{memberToDelete?.name}</strong>'s account will permanently erase their transaction history. This is non-reversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/80 rounded-xl" onClick={async () => { if (welfareRef && memberToDelete) { await deleteDoc(doc(welfareRef, memberToDelete.id)); setMemberToDelete(null); toast({ title: "Account closed and scrubbed." }); } }}>Permanently Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
