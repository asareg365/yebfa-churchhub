
"use client";

import { useState, useMemo } from "react";
import { 
  Users, 
  Plus, 
  Search, 
  Loader2, 
  Trash2, 
  Calendar as CalendarIcon, 
  MessageSquare,
  CheckCircle2,
  Clock,
  Heart,
  MoreVertical,
  Pencil
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, where, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function VisitorsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<any>(null);

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const visitorsRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, "churches", currentChurch.id, "visitors");
  }, [db, currentChurch?.id]);

  const { data: visitors, loading } = useCollection(visitorsRef ? query(visitorsRef, orderBy("visitDate", "desc")) : null);

  const [newVisitor, setNewVisitor] = useState({
    name: "",
    phone: "",
    visitDate: new Date().toISOString().split('T')[0],
    notes: ""
  });

  const handleAddVisitor = async () => {
    if (!newVisitor.name || !newVisitor.phone || !visitorsRef) return;
    try {
      await addDoc(visitorsRef, {
        ...newVisitor,
        followupSent: false,
        createdAt: serverTimestamp()
      });
      setIsAddOpen(false);
      setNewVisitor({ name: "", phone: "", visitDate: new Date().toISOString().split('T')[0], notes: "" });
      toast({ title: "Visitor recorded", description: "Automated follow-up will be sent tomorrow." });
    } catch (e: any) {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleUpdateVisitor = async () => {
    if (!editingVisitor || !visitorsRef) return;
    try {
      await updateDoc(doc(visitorsRef, editingVisitor.id), {
        name: editingVisitor.name,
        phone: editingVisitor.phone,
        visitDate: editingVisitor.visitDate,
        notes: editingVisitor.notes,
        updatedAt: serverTimestamp()
      });
      setIsEditOpen(false);
      setEditingVisitor(null);
      toast({ title: "Visitor updated" });
    } catch (e: any) {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const filteredVisitors = useMemo(() => {
    if (!visitors) return [];
    return visitors.filter(v => v.name?.toLowerCase().includes(searchTerm.toLowerCase()) || v.phone?.includes(searchTerm));
  }, [visitors, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1 text-foreground">Visitor Management</h2>
          <p className="text-muted-foreground">Proactive outreach to grow your congregation at {currentChurch?.name}.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl" disabled={!currentChurch}>
              <Plus className="mr-2 h-4 w-4" /> Record New Visitor
            </Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle>First-Time Visitor Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={newVisitor.name} onChange={e => setNewVisitor({...newVisitor, name: e.target.value})} placeholder="e.g. Michael Appiah" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={newVisitor.phone} onChange={e => setNewVisitor({...newVisitor, phone: e.target.value})} placeholder="024XXXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label>Visit Date</Label>
                <Input type="date" value={newVisitor.visitDate} onChange={e => setNewVisitor({...newVisitor, visitDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Outreach Notes</Label>
                <Textarea value={newVisitor.notes} onChange={e => setNewVisitor({...newVisitor, notes: e.target.value})} placeholder="e.g. Invited by Sister Mary" className="h-20" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddVisitor}>Save Visitor</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest">New This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{visitors?.length || 0}</div>
            <p className="text-[10px] text-accent flex items-center gap-1 mt-1 font-bold">
              <Heart className="w-3 h-3" /> Growing community
            </p>
          </CardContent>
        </Card>
        <Card className="glass border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Follow-up Automation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary">Active (24h Delay)</div>
            <p className="text-[10px] text-muted-foreground mt-1">SMS sent automatically next day.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass overflow-hidden border border-white/5">
        <CardHeader className="bg-white/5 border-b border-white/5 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Visitors</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search visitors..." className="pl-10 bg-white/10 rounded-xl h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-white/5">
                <TableHead>Visitor Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Visit Date</TableHead>
                <TableHead>Follow-up Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisitors.map((v) => (
                <TableRow key={v.id} className="hover:bg-white/5 transition-colors border-white/5">
                  <TableCell className="font-semibold">{v.name}</TableCell>
                  <TableCell><code className="text-xs">{v.phone}</code></TableCell>
                  <TableCell className="text-xs">{v.visitDate}</TableCell>
                  <TableCell>
                    {v.followupSent ? (
                      <Badge className="bg-accent text-white flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Sent</Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> Scheduled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass">
                        <DropdownMenuItem onClick={() => {
                          setEditingVisitor(v);
                          setIsEditOpen(true);
                        }}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="border-white/5" />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteDoc(doc(visitorsRef!, v.id))}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredVisitors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    No visitor records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Edit Visitor Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Edit Visitor Information</DialogTitle>
            <DialogDescription>Update the records for {editingVisitor?.name}.</DialogDescription>
          </DialogHeader>
          {editingVisitor && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editingVisitor.name} onChange={e => setEditingVisitor({...editingVisitor, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={editingVisitor.phone} onChange={e => setEditingVisitor({...editingVisitor, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Visit Date</Label>
                <Input type="date" value={editingVisitor.visitDate} onChange={e => setEditingVisitor({...editingVisitor, visitDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Outreach Notes</Label>
                <Textarea value={editingVisitor.notes} onChange={e => setEditingVisitor({...editingVisitor, notes: e.target.value})} className="h-20" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateVisitor}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
