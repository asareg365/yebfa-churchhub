
import { MoreVertical, Pencil, Zap, CheckCircle2, Ban, Trash2, CreditCard } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Church } from "@/types/admin";
import { cn } from "@/lib/utils";

interface OrganizationTableProps {
  ministries: Church[];
  onEdit: (church: Church) => void;
  onTopUp: (churchId: string) => void;
  onUpdateStatus: (churchId: string, status: string) => void;
  onDelete: (church: Church) => void;
}

export function OrganizationTable({ ministries, onEdit, onTopUp, onUpdateStatus, onDelete }: OrganizationTableProps) {
  return (
    <Table>
      <TableHeader className="bg-muted/10">
        <TableRow>
          <TableHead className="font-bold text-[10px] uppercase">Ministry</TableHead>
          <TableHead className="font-bold text-[10px] uppercase">Plan</TableHead>
          <TableHead className="font-bold text-[10px] uppercase">Status</TableHead>
          <TableHead className="font-bold text-[10px] uppercase">Balance</TableHead>
          <TableHead className="text-right font-bold text-[10px] uppercase">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ministries.map((church) => (
          <TableRow key={church.id} className="group hover:bg-muted/5 transition-colors">
            <TableCell>
              <div className="font-bold text-foreground">{church.name}</div>
              <code className="text-[10px] text-primary">{church.slug}</code>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-foreground font-bold">{church.plan || 'Starter'}</Badge>
            </TableCell>
            <TableCell>
              <Badge className={cn(
                "uppercase text-[9px] font-bold px-2 py-0.5", 
                church.sms?.subscriptionStatus === 'active' ? "bg-accent text-white" : 
                church.sms?.subscriptionStatus === 'suspended' ? "bg-destructive text-white" : 
                "bg-amber-100 text-amber-700"
              )}>
                {church.sms?.subscriptionStatus || 'Pending'}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <CreditCard className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono font-bold">{(church.sms?.credits || 0).toLocaleString()}</span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground group-hover:bg-white group-hover:shadow-sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass w-56">
                  <DropdownMenuItem onClick={() => onEdit(church)} className="font-bold">
                    <Pencil className="mr-2 h-4 w-4" /> Edit Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onTopUp(church.id)} className="font-bold text-primary">
                    <Zap className="mr-2 h-4 w-4" /> Top-up Wallet
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {church.sms?.subscriptionStatus !== 'active' ? (
                    <DropdownMenuItem onClick={() => onUpdateStatus(church.id, 'active')}>
                      <CheckCircle2 className="mr-2 h-4 w-4 text-accent" /> Activate Org
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => onUpdateStatus(church.id, 'suspended')} className="text-destructive">
                      <Ban className="mr-2 h-4 w-4" /> Suspend Service
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(church)} className="text-destructive font-bold focus:bg-destructive focus:text-white">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Ministry
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
        {ministries.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
              No active organizations found.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
