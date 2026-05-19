
"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Filter, Download, MoreVertical, QrCode, Mail, Phone, Loader2, Users as UsersIcon, Cake, Trash2 } from "lucide-react";
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
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, deleteDoc, query, where, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<any>(null);
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    const email = user.email.toLowerCase().trim();
    return query(collection(db, "churches"), where("adminEmails", "array-contains", email), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const membersRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, "churches", currentChurch.id, "members");
  }, [db, currentChurch?.id]);

  const { data: members, loading } = useCollection(membersRef);

  const [newMember, setNewMember] = useState({
    name: "",
    department: "Music",
    status: "Active" as const,
    gender: "Male" as const,
    dateOfBirth: ""
  });

  const handleAddMember = () => {
    if (!newMember.name || !membersRef) return;
    
    const memberData = {
      ...newMember,
      joined: new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp(),
      photo: `https://picsum.photos/seed/${Math.random()}/100/100`
    };

    addDoc(membersRef, memberData)
      .then(() => {
        setIsAddDialogOpen(false);
        setNewMember({ name: "", department: "Music", status: "Active", gender: "Male", dateOfBirth: "" });
        toast({ title: "Member added successfully" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: membersRef.path,
          operation: 'create',
          requestResourceData: memberData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleDeleteMember = () => {
    if (!memberToDelete || !membersRef) return;

    const docRef = doc(membersRef, memberToDelete.id);
    deleteDoc(docRef)
      .then(() => {
        setMemberToDelete(null);
        toast({ title: "Member removed from directory" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const filteredMembers = useMemo(() => {
    return (members || []).filter(m => {
      const matchesSearch = (m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.department?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusTab === "all" || m.status?.toLowerCase() === statusTab.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [members, searchTerm, statusTab]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Members</h2>
          <p className="text-muted-foreground">Managing directory for {currentChurch?.name || "your ministry"}.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none glass border-white/10">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 md:flex-none bg-primary hover:bg-primary/80" disabled={!currentChurch}>
                <Plus className="mr-2 h-4 w-4" /> Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="glass">
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    value={newMember.name} 
                    onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                    placeholder="John Doe" 
                    className="bg-white/5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={newMember.department} onValueChange={(v) => setNewMember({...newMember, department: v})}>
                      <SelectTrigger className="bg-white/5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass">
                        <SelectItem value="Music">Music</SelectItem>
                        <SelectItem value="Youth">Youth</SelectItem>
                        <SelectItem value="Media">Media</SelectItem>
                        <SelectItem value="Children">Children</SelectItem>
                        <SelectItem value="Welfare">Welfare</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={newMember.status} onValueChange={(v: any) => setNewMember({...newMember, status: v})}>
                      <SelectTrigger className="bg-white/5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass">
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Probation">Probation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input 
                    type="date"
                    value={newMember.dateOfBirth} 
                    onChange={(e) => setNewMember({...newMember, dateOfBirth: e.target.value})}
                    className="bg-white/5"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddMember}>Save Member</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="all" value={statusTab} onValueChange={setStatusTab} className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <TabsList className="glass border-white/10 p-1 rounded-2xl">
            <TabsTrigger value="all" className="rounded-xl px-6">All Members</TabsTrigger>
            <TabsTrigger value="active" className="rounded-xl px-6">Active</TabsTrigger>
            <TabsTrigger value="inactive" className="rounded-xl px-6">Inactive</TabsTrigger>
          </TabsList>
          
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name..." 
              className="pl-10 bg-white/5 border-white/10 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value={statusTab} className="mt-0">
          <div className="glass rounded-2xl overflow-hidden border border-white/5">
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow>
                    <TableHead className="w-[80px]"></TableHead>
                    <TableHead>Member Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id} className="hover:bg-white/5 transition-colors border-white/5">
                      <TableCell>
                        <Avatar className="h-10 w-10 border border-primary/20">
                          <AvatarImage src={member.photo} />
                          <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-semibold">{member.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                          {member.department}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "capitalize",
                          member.status === 'Active' ? 'text-accent border-accent/20' : 'text-muted-foreground border-white/10'
                        )}>
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.joined}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="glass">
                            <DropdownMenuItem className="cursor-pointer">
                              <QrCode className="mr-2 h-4 w-4" /> View QR ID
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">
                              <Mail className="mr-2 h-4 w-4" /> Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">
                              <Phone className="mr-2 h-4 w-4" /> Send SMS
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/5" />
                            <DropdownMenuItem 
                              className="cursor-pointer text-destructive focus:text-destructive"
                              onClick={() => setMemberToDelete(member)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredMembers.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <UsersIcon className="h-10 w-10 opacity-20" />
                          <p>No members found matching your criteria.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{memberToDelete?.name}</strong> from your congregation directory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMember}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
