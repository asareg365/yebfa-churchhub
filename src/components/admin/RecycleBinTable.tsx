
import { RotateCcw, Trash2, Archive } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Church } from "@/types/admin";
import { format } from "date-fns";

interface RecycleBinTableProps {
  ministries: Church[];
  isProcessing: boolean;
  onRestore: (churchId: string) => void;
  onPurge: (church: Church) => void;
}

export function RecycleBinTable({ ministries, isProcessing, onRestore, onPurge }: RecycleBinTableProps) {
  return (
    <Table>
      <TableHeader className="bg-muted/10">
        <TableRow>
          <TableHead className="font-bold text-[10px] uppercase">Deleted Ministry</TableHead>
          <TableHead className="font-bold text-[10px] uppercase">Date Deleted</TableHead>
          <TableHead className="font-bold text-[10px] uppercase">Slug</TableHead>
          <TableHead className="text-right font-bold text-[10px] uppercase">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ministries.map((church) => (
          <TableRow key={church.id} className="opacity-90 bg-muted/5 group hover:bg-muted/10 transition-colors">
            <TableCell>
              <div className="font-bold text-foreground flex items-center gap-2">
                {church.name}
                <Badge variant="outline" className="text-[8px] uppercase font-bold text-muted-foreground">In Recycle Bin</Badge>
              </div>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground font-medium">
              {church.deletedAt?.toDate ? format(church.deletedAt.toDate(), 'MMM d, yyyy HH:mm') : 'Unknown'}
            </TableCell>
            <TableCell><code className="text-[10px] text-muted-foreground">{church.slug}</code></TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 rounded-lg border-primary/20 text-primary hover:bg-primary/10 font-bold" 
                  onClick={() => onRestore(church.id)} 
                  disabled={isProcessing}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Restore
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-8 rounded-lg font-bold" 
                  onClick={() => onPurge(church)} 
                  disabled={isProcessing}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Purge
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {ministries.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center py-24">
              <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-50">
                <Archive className="w-12 h-12 mb-2" />
                <p className="text-sm font-medium">Recycle bin is empty.</p>
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
