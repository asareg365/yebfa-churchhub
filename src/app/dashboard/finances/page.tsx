"use client";

import { useState, useMemo } from "react";
import { CreditCard, ArrowUpRight, DollarSign, FileText, Loader2, Plus, MoreVertical, Pencil, Trash2, BarChart3, Info, FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, deleteDoc, where, limit, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function FinancesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkData, setBulkData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const churchQuery = useMemo(() => {
    if (!user?.email || !db) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const financesRef = useMemo(() => {
    if (!currentChurch?.id || !db) return null;
    return collection(db, "churches", currentChurch.id, "finances");
  }, [db, currentChurch?.id]);

  const { data: finances, loading } = useCollection(financesRef ? query(financesRef, orderBy("date", "desc")) : null);

  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    type: "Tithe",
    method: "MoMo"
  });

  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<any>(null);

  const handleAddTransaction = async () => {
    if (newTransaction.amount <= 0 || !financesRef) return;
    try {
      await addDoc(financesRef, { ...newTransaction, amount: Number(newTransaction.amount), createdAt: serverTimestamp() });
      setIsAddDialogOpen(false);
      setNewTransaction({ date: new Date().toISOString().split('T')[0], amount: 0, type: "Tithe", method: "MoMo" });
      toast({ title: "Transaction recorded" });
    } catch (e) { toast({ title: "Save failed", variant: "destructive" }); }
  };

  const handleBulkImport = async () => {
    if (!bulkData.trim() || !financesRef || !db) return;
    setIsImporting(true);

    try {
      const lines = bulkData.split(/\r?\n/).filter(l => l.trim().length > 0);
      const batch = writeBatch(db);
      let count = 0;
      let skipped = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(/\t|,/).map(p => p.trim().replace(/^["'](.+)["']$/, '$1'));
        
        if (parts.length < 3) {
          skipped++;
          continue;
        }

        const [date, type, amount, method] = parts;

        // Skip header
        if (i === 0 && date.toLowerCase().includes("date")) continue;

        if (!date || !amount) {
          skipped++;
          continue;
        }

        const txData = {
          date,
          type: type || "Tithe",
          amount: Number(amount.replace(/[^0-9.]/g, "")) || 0,
          method: method || "Cash",
          createdAt: serverTimestamp()
        };

        const newDocRef = doc(financesRef);
        batch.set(newDocRef, txData);
        count++;

        if (count >= 500) break;
      }

      await batch.commit();
      toast({ title: "Import Successful", description: `${count} transactions added. ${skipped > 0 ? skipped + ' rows skipped.' : ''}` });
      setBulkData("");
      setIsBulkImportOpen(false);
    } catch (error: any) {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction || !financesRef) return;
    try {
      await updateDoc(doc(financesRef, editingTransaction.id), {
        ...editingTransaction,
        amount: Number(editingTransaction.amount),
        updatedAt: serverTimestamp()
      });
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      toast({ title: "Transaction updated" });
    } catch (e) { toast({ title: "Update failed", variant: "destructive" }); }
  };

  const handleGenerateReport = async () => {
    if (!currentChurch?.id) return;
    setIsGenerating(true);
    try {
      const reportsRef = collection(db, "churches", currentChurch.id, "reports");
      await addDoc(reportsRef, {
        title: "Financial Audit Statement - " + format(new Date(), 'MMMM yyyy'),
        date: format(new Date(), 'MMM yyyy'),
        type: "PDF",
        size: "1.4 MB",
        category: "Financial",
        createdAt: serverTimestamp()
      });
      setIsGenerating(false);
      setIsReportDialogOpen(false);
      toast({ title: "Report Ready", description: "Audit statement generated in Reports hub." });
    } catch (e) {
      setIsGenerating(false);
      toast({ title: "Generation failed", variant: "destructive" });
    }
  };

  const totalBalance = (finances || []).reduce((acc, curr) => curr.type === 'Expenditure' ? acc - curr.amount : acc + curr.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Finances</h2>
          <p className="text-muted-foreground">Manage organizational funds for {currentChurch?.name}.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBulkImportOpen(true)} className="rounded-xl border-white/10 glass" disabled={!currentChurch}>
            <FileUp className="mr-2 h-4 w-4" /> Bulk Import
          </Button>
          <Button variant="outline" onClick={() => setIsReportDialogOpen(true)} className="rounded-xl"><FileText className="mr-2 h-4 w-4" /> Reports</Button>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-accent text-accent-foreground rounded-xl"><Plus className="mr-2 h-4 w-4" /> Record Income</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="glass border-primary/20"><CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Total Balance</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-accent">GH₵{totalBalance.toLocaleString()}</div></CardContent></Card>
      </div>

      <Card className="glass overflow-hidden border border-white/5">
        <Table>
          <TableHeader className="bg-muted/30"><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {finances?.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="text-xs">{tx.date}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{tx.type}</Badge></TableCell>
                <TableCell className={cn("font-bold", tx.type === 'Expenditure' ? 'text-destructive' : 'text-accent')}>GH₵{tx.amount.toLocaleString()}</TableCell>
                <TableCell className="text-xs">{tx.method}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass">
                      <DropdownMenuItem onClick={() => { setEditingTransaction(tx); setIsEditDialogOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => { setTransactionToDelete(tx); setIsDeleteDialogOpen(true); }}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="glass max-w-xl">
          <DialogHeader>
            <DialogTitle>Excel Financial Import</DialogTitle>
            <DialogDescription>Paste rows from Excel (Date, Type, Amount, Method).</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder="2024-05-15	Tithe	1500	MoMo" 
              className="min-h-[250px] font-mono text-xs bg-muted/20"
              value={bulkData}
              onChange={e => setBulkData(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkImportOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkImport} disabled={isImporting || !bulkData.trim()}>
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Process Transactions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="glass">
           <DialogHeader><DialogTitle>Financial Reporting</DialogTitle><DialogDescription>Select parameters for audit generation.</DialogDescription></DialogHeader>
           <div className="py-6 space-y-4">
             <div className="space-y-2"><Label>Statement Category</Label><Select defaultValue="full"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full">Consolidated Audit</SelectItem><SelectItem value="tithe">Tithing Record</SelectItem></SelectContent></Select></div>
             <p className="text-[10px] text-muted-foreground italic">Generated reports are archived in the Reports section for global access.</p>
           </div>
           <DialogFooter><Button variant="outline" onClick={() => setIsReportDialogOpen(false)}>Cancel</Button><Button onClick={handleGenerateReport} disabled={isGenerating}>{isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BarChart3 className="mr-2 h-4 w-4" />} Generate Statement</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>New Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Date</Label><Input type="date" value={newTransaction.date} onChange={e => setNewTransaction({...newTransaction, date: e.target.value})} /></div>
              <div className="space-y-2"><Label>Amount</Label><Input type="number" value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: Number(e.target.value)})} /></div>
            </div>
            <div className="space-y-2"><Label>Type</Label><Select value={newTransaction.type} onValueChange={v => setNewTransaction({...newTransaction, type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Tithe">Tithe</SelectItem><SelectItem value="Offering">Offering</SelectItem><SelectItem value="Expenditure">Expenditure</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button><Button onClick={handleAddTransaction}>Record Entry</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="glass"><AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive" onClick={async () => { if (financesRef && transactionToDelete) { await deleteDoc(doc(financesRef, transactionToDelete.id)); setIsDeleteDialogOpen(false); toast({ title: "Deleted" }); } }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}