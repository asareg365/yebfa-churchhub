"use client";

import { useState, useMemo, useEffect } from "react";
import { CheckCircle2, Clock, Users, Plus, Loader2, Calendar as CalendarIcon, History, BarChart3, Fingerprint, ShieldCheck } from "lucide-react";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

export default function AttendancePage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const churchQuery = useMemo(() => {
    if (!user?.email || !db) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const attendanceRef = useMemo(() => {
    if (!currentChurch?.id || !db) return null;
    return collection(db, "churches", currentChurch.id, "attendance");
  }, [db, currentChurch?.id]);

  const attendanceQuery = useMemo(() => {
    if (!attendanceRef) return null;
    return query(attendanceRef, orderBy("date", "desc"), limit(50));
  }, [attendanceRef]);

  const { data: attendance, loading } = useCollection(attendanceQuery);

  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    serviceName: "Sunday Main Service",
    count: 0
  });

  const handleAddRecord = () => {
    if (newRecord.count <= 0 || !attendanceRef) return;
    
    const recordData = {
      ...newRecord,
      count: Number(newRecord.count),
      createdAt: serverTimestamp()
    };

    addDoc(attendanceRef, recordData)
      .then(() => {
        setIsDialogOpen(false);
        setNewRecord({
          date: new Date().toISOString().split('T')[0],
          serviceName: "Sunday Main Service",
          count: 0
        });
        toast({ title: "Attendance record saved" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: attendanceRef.path,
          operation: 'create',
          requestResourceData: recordData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const chartData = useMemo(() => [...(attendance || [])].reverse(), [attendance]);
  const lastSunday = attendance?.[0]?.count || 0;

  if (!mounted) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Attendance</h2>
          <p className="text-muted-foreground">Monitor service trends for {currentChurch?.name || 'your ministry'}.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary" disabled={!currentChurch}>
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
                  <Input type="number" value={newRecord.count} onChange={(e) => setNewRecord({...newRecord, count: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddRecord}>Save Record</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{lastSunday}</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Latest Count</p>
          </div>
        </Card>
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">85%</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Retention</p>
          </div>
        </Card>
        <Card className="glass p-6 flex items-center gap-4 border-primary/20 bg-primary/5">
          <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
            <Fingerprint className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <p className="text-xl font-bold">0</p>
              <Badge className="text-[8px] h-4">Future Update</Badge>
            </div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Biometric Logins</p>
          </div>
        </Card>
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-muted/10 flex items-center justify-center text-muted-foreground">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">45m</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Peak Time</p>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="log" className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="log" className="rounded-xl px-6">
            <History className="w-4 h-4 mr-2" />
            Service Log
          </TabsTrigger>
          <TabsTrigger value="trends" className="rounded-xl px-6">
            <BarChart3 className="w-4 h-4 mr-2" />
            Trends Analysis
          </TabsTrigger>
          <TabsTrigger value="biometrics" className="rounded-xl px-6">
            <Fingerprint className="w-4 h-4 mr-2" />
            Smart Check-in
          </TabsTrigger>
        </TabsList>

        <TabsContent value="log">
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
                      <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                        <CalendarIcon className="h-10 w-10 mx-auto mb-4 opacity-20" />
                        No records found. Start recording attendance.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card className="glass h-[400px]">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Growth Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {loading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : attendance?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Record more data to see trends.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="biometrics">
          <Card className="glass min-h-[400px] flex flex-col items-center justify-center text-center p-12">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 relative">
              <Fingerprint className="w-12 h-12 text-primary" />
              <div className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">Coming Soon</div>
            </div>
            <h3 className="text-2xl font-bold mb-2">Biometric Smart Check-in</h3>
            <p className="text-muted-foreground max-w-md leading-relaxed">
              We are working on integrating advanced biometric authentication for instantaneous member check-in. This feature will support fingerprint and facial recognition scanners directly synced with your congregation directory.
            </p>
            <div className="mt-8 flex gap-4">
              <Button variant="outline" disabled className="rounded-xl">
                <ShieldCheck className="w-4 h-4 mr-2" /> Hardware Setup
              </Button>
              <Button variant="outline" disabled className="rounded-xl">
                View Access Logs
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
