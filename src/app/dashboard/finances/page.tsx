
"use client";

import { useState, useMemo } from "react";
import { CreditCard, ArrowUpRight, DollarSign, FileText, Loader2, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, deleteDoc, where, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function FinancesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Resolve current church context
  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const financesRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, "churches", currentChurch.id, "finances");
  }, [db, currentChurch?.id]);

  const financesQuery = useMemo(() => {
    if (!financesRef) return null;
    return query(financesRef, orderBy("date", "desc"));
  }, [financesRef]);

  const { data: finances, loading } = useCollection(financesQuery);

  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    type: "Tithe",
    method: "Bank Transfer"
  });

  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<any>(null);

  const handleAddTransaction = () => {
    if (newTransaction.amount <= 0 || !financesRef) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    
    const transactionData = {
      ...newTransaction,
      amount: Number(newTransaction.amount),
      createdAt: serverTimestamp()
    };

    addDoc(financesRef, transactionData)
      .then(() => {
        setIsAddDialogOpen(false);
        setNewTransaction({ date: new Date().toISOString().split('T')[0], amount: 0, type: "Tithe", method: "Bank Transfer" });
        toast({ title: "Transaction recorded in GH₵" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: financesRef.path,
          operation: 'create',
          requestResourceData: transactionData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleUpdateTransaction = () => {
    if (!editingTransaction || editingTransaction.amount <= 0 || !financesRef) return;

    const docRef = doc(financesRef, editingTransaction.id);
    const updateData = {
      date: editingTransaction.date,
      amount: Number(editingTransaction.amount),
      type: editingTransaction.type,
      method: editingTransaction.method,
      updatedAt: serverTimestamp()
    };

    updateDoc(docRef, updateData)
      .then(() => {
        setIsEditDialogOpen(false);
        setEditingTransaction(null);
        toast({ title: "Transaction updated" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleDeleteTransaction = () => {
    if (!transactionToDelete || !financesRef) return;

    const docRef = doc(financesRef, transactionToDelete.id);
    deleteDoc(docRef)
      .then(() => {
        setIsDeleteDialogOpen(false);
        setTransactionToDelete(null);
        toast({ title: "Transaction deleted" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const totalBalance = (finances || []).reduce((acc, curr) => 
    curr.type === 'Expenditure' ? acc - curr.amount : acc + curr.amount, 0
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Finances</h2>
          <p className="text-muted-foreground">Manage tithes and offerings for {currentChurch?.name || "your ministry"}.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="glass border-border">
            <FileText className="mr-2 h-4 w-4" /> Reports
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/80" disabled={!currentChurch}>
                <Plus className="mr-2 h-4 w-4" /> Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="glass">
              <DialogHeader>
                <DialogTitle>Add Financial Transaction</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={newTransaction.date} onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (GH₵)</Label>
                    <Input type="number" value={newTransaction.amount} onChange={(e) => setNewTransaction({...newTransaction, amount: parseFloat(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Transaction Type</Label>
                  <Select value={newTransaction.type} onValueChange={(v) => setNewTransaction({...newTransaction, type: v})}>
                    <SelectTrigger className="bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass">
                      <SelectItem value="Tithe">Tithe</SelectItem>
                      <SelectItem value="Offering">Offering</SelectItem>
                      <SelectItem value="Donation">Donation</SelectItem>
                      <SelectItem value="Expenditure">Expenditure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Input value={newTransaction.method} onChange={(e) => setNewTransaction({...newTransaction, method: e.target.value})} placeholder="e.g. Bank Transfer, MoMo" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddTransaction}>Save Transaction</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">GH₵{totalBalance.toLocaleString()}</div>
            <p className="text-xs text-accent flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> Account health stable
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-border">
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finances?.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.date}</TableCell>
                  <TableCell>{record.type}</TableCell>
                  <TableCell className={cn(
                    "font-semibold",
                    record.type === 'Expenditure' ? 'text-destructive' : 'text-accent'
                  )}>
                    {record.type === 'Expenditure' ? '-' : ''}GH₵{record.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>{record.method}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass">
                        <DropdownMenuItem onClick={() => {
                          setEditingTransaction(record);
                          setIsEditDialogOpen(true);
                        }}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => {
                          setTransactionToDelete(record);
                          setIsDeleteDialogOpen(true);
                        }}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {finances?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No financial records found. Start by adding a transaction.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          {editingTransaction && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={editingTransaction.date} onChange={(e) => setEditingTransaction({...editingTransaction, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Amount (GH₵)</Label>
                  <Input type="number" value={editingTransaction.amount} onChange={(e) => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Transaction Type</Label>
                <Select value={editingTransaction.type} onValueChange={(v) => setEditingTransaction({...editingTransaction, type: v})}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass">
                    <SelectItem value="Tithe">Tithe</SelectItem>
                    <SelectItem value="Offering">Offering</SelectItem>
                    <SelectItem value="Donation">Donation</SelectItem>
                    <SelectItem value="Expenditure">Expenditure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Input value={editingTransaction.method} onChange={(e) => setEditingTransaction({...editingTransaction, method: e.target.value})} placeholder="e.g. Bank Transfer" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateTransaction}>Update Transaction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this record from your financial history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/80" onClick={handleDeleteTransaction}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
