
"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Users, Plus, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCollection, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function AttendancePage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const attendanceRef = collection(db, "attendance");
  const attendanceQuery = query(attendanceRef, orderBy("date", "desc"), limit(20));
  const { data: attendance, loading } = useCollection(attendanceQuery);

  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    serviceName: "Sunday Main Service",
    count: 0
  });

  const handleAddRecord = async () => {
    if (newRecord.count <= 0) return;
    try {
      addDoc(attendanceRef, {
        ...newRecord,
        count: Number(newRecord.count),
        createdAt: serverTimestamp()
      });
      setIsDialogOpen(false);
      toast({ title: "Attendance record saved" });
    } catch (e) {
      toast({ title: "Error saving record", variant: "destructive" });
    }
  };

  const lastSunday = attendance?.[0]?.count || 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Attendance</h2>
          <p className="text-muted-foreground">Monitor congregation presence and service trends.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary">
              <Plus className="mr-2 h-4 w-4" /> Record Attendance
            </Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle>Record Service Attendance</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Service Date</Label>
                <Input type="date" value={newRecord.date} onChange={(e) => setNewRecord({...newRecord, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Service Name</Label>
                <Input placeholder="Sunday Main Service" value={newRecord.serviceName} onChange={(e) => setNewRecord({...newRecord, serviceName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Headcount</Label>
                <Input type="number" value={newRecord.count} onChange={(e) => setNewRecord({...newRecord, count: parseInt(e.target.value)})} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddRecord}>Save Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{lastSunday}</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Latest Service Count</p>
          </div>
        </Card>
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">85%</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Avg. Retention</p>
          </div>
        </Card>
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-muted/10 flex items-center justify-center text-muted-foreground">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">45 min</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Peak Check-in Time</p>
          </div>
        </Card>
      </div>

      <Card className="glass overflow-hidden border border-white/5">
        <CardHeader className="bg-white/5 border-b border-white/5">
          <CardTitle className="text-lg">Recent Service Records</CardTitle>
        </CardHeader>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead>Date</TableHead>
                <TableHead>Service Name</TableHead>
                <TableHead>Headcount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance?.map((record) => (
                <TableRow key={record.id} className="hover:bg-white/5 transition-colors border-white/5">
                  <TableCell className="font-medium">{record.date}</TableCell>
                  <TableCell>{record.serviceName}</TableCell>
                  <TableCell>{record.count}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Details</Button>
                  </TableCell>
                </TableRow>
              ))}
              {attendance?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    No records found. Start recording attendance.
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
