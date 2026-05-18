
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  Users, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Building2,
  Clock,
  RefreshCcw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, doc, updateDoc, query, orderBy, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];

export default function SystemAdminPortal() {
  const { user, loading: userLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Stabilize the query to avoid infinite re-renders
  const churchesQuery = useMemo(() => {
    return query(collection(db, "churches"), orderBy("registeredAt", "desc"));
  }, [db]);

  const { data: churches, loading: collectionLoading } = useCollection(churchesQuery);

  useEffect(() => {
    if (!userLoading && (!user || !SUPER_ADMINS.includes(user.email || ""))) {
      router.push("/dashboard");
    }
  }, [user, userLoading, router]);

  if (userLoading || !user || !SUPER_ADMINS.includes(user.email || "")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const handleUpdateStatus = (churchId: string, newStatus: string) => {
    const churchDoc = doc(db, "churches", churchId);
    updateDoc(churchDoc, { status: newStatus })
      .then(() => {
        toast({ title: `Church ${newStatus.toLowerCase()} successfully` });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: churchDoc.path,
          operation: 'update',
          requestResourceData: { status: newStatus },
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const filteredChurches = (churches || []).filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.adminEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = [
    { label: "Total Churches", value: churches?.length || 0, icon: Building2, color: "text-primary" },
    { label: "Pending Approval", value: churches?.filter(c => c.status === "Pending").length || 0, icon: Clock, color: "text-accent" },
    { label: "Active Subscriptions", value: churches?.filter(c => c.status === "Approved").length || 0, icon: ShieldCheck, color: "text-green-500" },
  ];

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Pending...';
    if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString();
    if (ts.toDate) return ts.toDate().toLocaleDateString();
    return 'N/A';
  };

  return (
    <div className="min-h-screen bg-background p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            System Admin Portal
          </h2>
          <p className="text-muted-foreground text-lg">Manage ministry registrations and approve service activations.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => window.location.reload()} className="glass border-white/10">
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")} className="glass border-white/10">
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase">{stat.label}</CardTitle>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div>
            <CardTitle className="text-xl">Ministry Directory</CardTitle>
            <CardDescription>Review and manage all organizations on the Hub.</CardDescription>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or email..." 
              className="pl-10 bg-white/5 border-white/10 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {collectionLoading ? (
            <div className="p-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5">
                  <TableHead>Church Name</TableHead>
                  <TableHead>Admin Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChurches.map((church) => (
                  <TableRow key={church.id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="font-bold">{church.name}</TableCell>
                    <TableCell className="text-muted-foreground">{church.adminEmail}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                        {church.plan || "Starter"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "capitalize",
                        church.status === 'Approved' ? 'bg-green-500/10 text-green-500' : 
                        church.status === 'Pending' ? 'bg-accent/10 text-accent' : 
                        'bg-destructive/10 text-destructive'
                      )}>
                        {church.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimestamp(church.registeredAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass">
                          <DropdownMenuItem 
                            className="text-green-500 focus:text-green-500"
                            onClick={() => handleUpdateStatus(church.id, "Approved")}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Approve & Activate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleUpdateStatus(church.id, "Suspended")}
                          >
                            <XCircle className="mr-2 h-4 w-4" /> Suspend Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredChurches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                      No ministries found in the directory.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
