
"use client";

import { useState } from "react";
import { Plus, Search, Filter, Download, MoreVertical, QrCode, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MOCK_MEMBERS } from "@/app/lib/mock-data";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMembers = MOCK_MEMBERS.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.department.toLowerCase().includes(searchTerm.toLowerCase())
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
          <Button className="flex-1 md:flex-none bg-primary hover:bg-primary/80">
            <Plus className="mr-2 h-4 w-4" /> Add Member
          </Button>
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
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
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
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
