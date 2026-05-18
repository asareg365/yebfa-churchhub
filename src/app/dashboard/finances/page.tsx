
"use client";

import { useState } from "react";
import { CreditCard, ArrowUpRight, DollarSign, FileText, Loader2, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollection, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function FinancesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const financesRef = collection(db, "finances");
  const financesQuery = query(financesRef, orderBy("date", "desc"));
  const { data: finances, loading } = useCollection(financesQuery);

  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    type: "Tithe",
    method: "Bank Transfer"
  });

  const handleAddTransaction = async () => {
    if (newTransaction.amount <= 0) return;
    try {
      addDoc(financesRef, {
        ...newTransaction,
        amount: Number(newTransaction.amount),
        createdAt: serverTimestamp()
      });
      setIsDialogOpen(false);
      setNewTransaction({ date: new Date().toISOString().split('T')[0], amount: 0, type: "Tithe", method: "Bank Transfer" });
      toast({ title: "Transaction recorded" });
    } catch (e) {
      toast({ title: "Error recording transaction", variant: "destructive" });
    }
  };

  const totalBalance = (finances || []).reduce((acc, curr) => 
    curr.type === 'Expenditure' ? acc - curr.amount : acc + curr.amount, 0
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Finances</h2>
          <p className="text-muted-foreground">Detailed overview of tithes, offerings, and expenditures.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="glass border-white/10">
            <FileText className="mr-2 h-4 w-4" /> Reports
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/80">
                <DollarSign className="mr-2 h-4 w-4" /> Add Transaction
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
                    <Label>Amount ($)</Label>
                    <Input type="number" value={newTransaction.amount} onChange={(e) => setNewTransaction({...newTransaction, amount: parseFloat(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Transaction Type</Label>
                  <Select value={newTransaction.type} onValueChange={(v) => setNewTransaction({...newTransaction, type: v})}>
                    <SelectTrigger className="bg-white/5">
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
                  <Input value={newTransaction.method} onChange={(e) => setNewTransaction({...newTransaction, method: e.target.value})} placeholder="Bank Transfer" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
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
            <div className="text-2xl font-bold">${totalBalance.toLocaleString()}</div>
            <p className="text-xs text-accent flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> Account health stable
            </p>
          </CardContent>
        </Card>
        {/* Additional stat cards can be added here */}
      </div>

      <Card className="glass border-white/5">
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finances?.map((record, i) => (
                <TableRow key={record.id} className="border-white/5">
                  <TableCell>{record.date}</TableCell>
                  <TableCell>{record.type}</TableCell>
                  <TableCell className={cn(
                    "font-semibold",
                    record.type === 'Expenditure' ? 'text-destructive' : 'text-accent'
                  )}>
                    {record.type === 'Expenditure' ? '-' : ''}${record.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>{record.method}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">Verified</TableCell>
                </TableRow>
              ))}
              {finances?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No financial records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
