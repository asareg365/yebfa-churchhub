
"use client";

import { useState } from "react";
import { Plus, Search, Filter, Download, MoreVertical, QrCode, Mail, Phone, Loader2 } from "lucide-react";
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const db = useFirestore();
  const { toast } = useToast();
  
  const membersRef = collection(db, "members");
  const { data: members, loading } = useCollection(membersRef);

  const [newMember, setNewMember] = useState({
    name: "",
    department: "Music",
    status: "Active",
    gender: "Male"
  });

  const handleAddMember = async () => {
    if (!newMember.name) return;
    try {
      addDoc(membersRef, {
        ...newMember,
        joined: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        photo: `https://picsum.photos/seed/${Math.random()}/100/100`
      });
      setIsAddDialogOpen(false);
      setNewMember({ name: "", department: "Music", status: "Active", gender: "Male" });
      toast({ title: "Member added successfully" });
    } catch (e) {
      toast({ title: "Error adding member", variant: "destructive" });
    }
  };

  const filteredMembers = (members || []).filter(m => 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Members</h2>
          <p className="text-muted-foreground">Manage your congregation records and growth analytics.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none glass border-white/10">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 md:flex-none bg-primary hover:bg-primary/80">
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
                    <Select value={newMember.status} onValueChange={(v) => setNewMember({...newMember, status: v})}>
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddMember}>Save Member</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center glass p-4 rounded-2xl">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or department..." 
            className="pl-10 bg-white/5 border-white/10 rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="ghost" className="text-muted-foreground">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredMembers.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No members found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
