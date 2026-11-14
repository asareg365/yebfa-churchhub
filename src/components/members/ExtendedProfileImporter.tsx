"use client";

import { useState, useMemo, useRef } from "react";
import { 
  FileUp, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  FileText,
  ArrowLeft,
  Database,
  UserPlus,
  ClipboardCheck,
  DownloadCloud,
  Layers,
  Search
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, writeBatch, serverTimestamp, collection } from "firebase/firestore";
import { format, parse, isValid } from "date-fns";
import { cn } from "@/lib/utils";

interface ExtendedProfileImporterProps {
  churchId: string;
  members: any[];
}

type ImportStep = 'upload' | 'preview' | 'processing' | 'results';
type ImportMode = 'create' | 'update';

interface CSVRow {
  memberId: string;
  phoneNumber: string;
  firstName: string;
  otherNames: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  maritalStatus: string;
  educationLevel: string;
  baptised: string;
  baptismDate: string;
  confirmed: string;
  confirmationPlace: string;
  confirmationDate: string;
  [key: string]: string;
}

interface ValidationResult {
  row: number;
  data: CSVRow;
  matchedMember: any | null;
  status: 'valid' | 'invalid' | 'conflict' | 'not_found' | 'ambiguous' | 'duplicate';
  errors: string[];
  updates: string[];
}

export function ExtendedProfileImporter({ churchId, members }: ExtendedProfileImporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>('upload');
  const [importMode, setImportMode] = useState<ImportMode>('update');
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0, skipped: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const db = useFirestore();

  const normalizePhone = (phone: string) => phone?.replace(/\D/g, "") || "";

  const resetState = () => {
    setStep('upload');
    setValidationResults([]);
    setImportStats({ total: 0, success: 0, failed: 0, skipped: 0 });
    setIsProcessing(false);
  };

  const downloadTemplate = () => {
    const headers = [
      "memberId", "phoneNumber", "firstName", "otherNames", "lastName", 
      "dateOfBirth", "placeOfBirth", "maritalStatus", "educationLevel", 
      "baptised", "baptismDate", "confirmed", "confirmationPlace", "confirmationDate"
    ];
    const sampleRow = importMode === 'update' 
      ? ["ID_FROM_DASHBOARD", "0240000000", "John", "Kofi", "Doe", "15/05/1990", "Accra", "Married", "Bachelor's Degree", "Yes", "20/12/2010", "Yes", "Grace Sanctuary", "10/11/2015"]
      : ["", "0240000000", "Sarah", "", "Mensah", "12/03/1995", "Kumasi", "Single", "Diploma", "No", "", "No", "", ""];
    
    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `churchhub_${importMode}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim().replace(/^"(.*)"$/, '$1') || "";
      });
      return row as CSVRow;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const parsed = parseCSV(event.target?.result as string);
      if (parsed.length === 0) {
        toast({ title: "Invalid File", description: "CSV file is empty or invalid.", variant: "destructive" });
        return;
      }
      validateData(parsed);
    };
    reader.readAsText(file);
  };

  const validateData = (rows: CSVRow[]) => {
    const results: ValidationResult[] = rows.map((row, index) => {
      const errors: string[] = [];
      const updates: string[] = [];
      let matchedMember = null;
      let status: ValidationResult['status'] = 'valid';

      const csvPhone = normalizePhone(row.phoneNumber);

      // 1. Matching Logic
      if (row.memberId) {
        matchedMember = members.find(m => m.id === row.memberId);
      }

      if (!matchedMember && csvPhone) {
        const phoneMatches = members.filter(m => normalizePhone(m.phone) === csvPhone);
        if (phoneMatches.length === 1) matchedMember = phoneMatches[0];
        else if (phoneMatches.length > 1) {
          status = 'ambiguous';
          errors.push(`Multiple matches for phone: ${row.phoneNumber}`);
        }
      }

      // 2. Mode-Specific Validation
      if (importMode === 'update') {
        if (!matchedMember && status !== 'ambiguous') {
          status = 'not_found';
          errors.push("No existing record found.");
        }
      } else {
        if (matchedMember) {
          status = 'duplicate';
          errors.push(`Conflict: Member already exists (${matchedMember.name}).`);
        }
        if (!row.firstName || !row.lastName || !row.phoneNumber) {
          status = 'invalid';
          errors.push("Missing required fields (First Name, Last Name, Phone).");
        }
      }

      // 3. Data Integrity
      if (row.dateOfBirth) {
        const d = parse(row.dateOfBirth, 'dd/MM/yyyy', new Date());
        if (!isValid(d)) { errors.push("Invalid DOB (DD/MM/YYYY)"); status = 'invalid'; }
        else updates.push("DOB");
      }
      if (row.firstName || row.lastName) updates.push("Identity");
      if (row.placeOfBirth || row.maritalStatus) updates.push("Personal");
      if (row.baptised?.toLowerCase() === 'yes') updates.push("Baptism");
      if (row.confirmed?.toLowerCase() === 'yes') updates.push("Confirmation");

      return { row: index + 1, data: row, matchedMember, status, errors, updates };
    });

    setValidationResults(results);
    setStep('preview');
  };

  const executeImport = async () => {
    const targetRows = validationResults.filter(r => r.status === 'valid');
    if (targetRows.length === 0) return;

    setIsProcessing(true);
    setStep('processing');
    
    let successCount = 0;
    let failedCount = 0;
    const batchSize = 100;
    const membersRef = collection(db, "churches", churchId, "members");

    for (let i = 0; i < targetRows.length; i += batchSize) {
      const chunk = targetRows.slice(i, i + batchSize);
      const batch = writeBatch(db);

      chunk.forEach(res => {
        const { data } = res;
        const ext: any = res.matchedMember?.extendedProfile || {
          baptism: { baptised: false, date: "" },
          confirmation: { confirmed: false, place: "", date: "" }
        };
        
        if (data.firstName) ext.firstName = data.firstName;
        if (data.otherNames) ext.otherNames = data.otherNames;
        if (data.lastName) ext.lastName = data.lastName;
        if (data.placeOfBirth) ext.placeOfBirth = data.placeOfBirth;
        if (data.maritalStatus) ext.maritalStatus = data.maritalStatus;
        if (data.educationLevel) ext.educationLevel = data.educationLevel;
        
        if (data.dateOfBirth) {
          ext.dateOfBirth = format(parse(data.dateOfBirth, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd');
        }

        if (data.baptised) {
          ext.baptism = {
            baptised: data.baptised.toLowerCase() === 'yes',
            date: data.baptismDate ? format(parse(data.baptismDate, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd') : ""
          };
        }

        if (data.confirmed) {
          ext.confirmation = {
            confirmed: data.confirmed.toLowerCase() === 'yes',
            place: data.confirmationPlace || "",
            date: data.confirmationDate ? format(parse(data.confirmationDate, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd') : ""
          };
        }

        const profileStatus = (['firstName', 'lastName', 'placeOfBirth'].every(f => !!ext[f])) ? "Complete" : "Incomplete";
        const finalName = `${ext.firstName || ''} ${ext.otherNames || ''} ${ext.lastName || ''}`.replace(/\s+/g, ' ').trim() || res.matchedMember?.name || data.firstName;

        if (importMode === 'update') {
          batch.update(doc(membersRef, res.matchedMember.id), { extendedProfile: ext, name: finalName, profileStatus, updatedAt: serverTimestamp() });
        } else {
          batch.set(doc(membersRef), { 
            name: finalName, phone: data.phoneNumber, extendedProfile: ext, profileStatus, 
            status: "Active", joined: format(new Date(), 'yyyy-MM-dd'), createdAt: serverTimestamp() 
          });
        }
      });

      try { await batch.commit(); successCount += chunk.length; } catch (e) { failedCount += chunk.length; }
    }

    setImportStats({ total: validationResults.length, success: successCount, failed: failedCount, skipped: validationResults.length - successCount - failedCount });
    setStep('results');
    setIsProcessing(false);
  };

  const downloadErrorLog = () => {
    const errorRows = validationResults.filter(r => r.status !== 'valid');
    const headers = ["Row", "MemberID", "Phone", "Status", "Errors"];
    const csvContent = [headers.join(","), ...errorRows.map(r => [r.row, r.data.memberId, r.data.phoneNumber, r.status.toUpperCase(), `"${r.errors.join('; ')}"`].join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `import_errors_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if(!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5">
          <FileUp className="w-4 h-4 mr-2" /> CSV Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="glass max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-muted/20 border-b">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Multi-Tenant CSV Importer
              </DialogTitle>
              <DialogDescription>Bulk register or update members for {churchId}.</DialogDescription>
            </div>
            {step !== 'upload' && !isProcessing && (
              <Button variant="ghost" size="sm" onClick={resetState} className="h-8">
                <ArrowLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6">
          {step === 'upload' && (
            <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
              <Card className="w-full max-w-md p-6 glass border-primary/20">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Selection Mode</Label>
                    <Select value={importMode} onValueChange={(v: ImportMode) => setImportMode(v)}>
                      <SelectTrigger className="rounded-xl h-11 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass">
                        <SelectItem value="update">Update Existing Profiles</SelectItem>
                        <SelectItem value="create">Register New Members</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                    <p className="text-xs text-primary font-bold flex items-center gap-2 uppercase tracking-widest">
                      {importMode === 'update' ? <Search className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                      {importMode === 'update' ? "Match & Sync" : "Bulk Registration"}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {importMode === 'update' 
                        ? "Matching by Member ID or unique Phone Number. Blank CSV cells will not erase existing data." 
                        : "Required fields: First Name, Last Name, Phone. Duplicates will be rejected automatically."}
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
                <div className="flex flex-col items-center p-8 rounded-[2rem] bg-muted/20 border-2 border-dashed border-border hover:border-primary/40 transition-all cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                  <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-4">
                    <DownloadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Upload Data</h3>
                  <Input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                  <Button variant="outline" className="rounded-xl px-8">Browse CSV</Button>
                </div>

                <div className="flex flex-col items-center p-8 rounded-[2rem] bg-accent/5 border border-accent/10 hover:border-accent/30 transition-all">
                  <div className="h-16 w-16 rounded-3xl bg-accent/10 flex items-center justify-center text-accent mb-4">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Get Template</h3>
                  <Button onClick={downloadTemplate} className="rounded-xl px-8 bg-accent text-white">Download Template</Button>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="h-full flex flex-col space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-wrap gap-4 items-center justify-between bg-muted/20 p-4 rounded-2xl border">
                <div className="flex gap-6">
                  <div className="text-center"><p className="text-[10px] font-bold text-muted-foreground uppercase">Rows</p><p className="text-lg font-bold">{validationResults.length}</p></div>
                  <div className="text-center"><p className="text-[10px] font-bold text-accent uppercase">Valid</p><p className="text-lg font-bold text-accent">{validationResults.filter(r => r.status === 'valid').length}</p></div>
                  <div className="text-center"><p className="text-[10px] font-bold text-destructive uppercase">Issues</p><p className="text-lg font-bold text-destructive">{validationResults.filter(r => r.status !== 'valid').length}</p></div>
                </div>
                <div className="flex gap-2">
                  {validationResults.some(r => r.status !== 'valid') && (
                    <Button variant="outline" size="sm" onClick={downloadErrorLog} className="rounded-lg h-9 text-destructive border-destructive/20">Download Issues</Button>
                  )}
                  <Button onClick={executeImport} className="rounded-xl h-9 bg-primary" disabled={!validationResults.some(r => r.status === 'valid')}>
                    <ClipboardCheck className="w-4 h-4 mr-2" /> Start Import
                  </Button>
                </div>
              </div>

              <div className="border rounded-2xl overflow-hidden flex-1">
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-20">
                      <TableRow>
                        <TableHead className="w-[50px] text-[10px] font-bold uppercase">Row</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Identification</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Errors / Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResults.map((res) => (
                        <TableRow key={res.row} className="hover:bg-muted/5 border-border">
                          <TableCell className="text-xs font-mono font-bold text-muted-foreground">{res.row}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-bold text-sm">{res.matchedMember?.name || `${res.data.firstName} ${res.data.lastName}`}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">{res.data.phoneNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-bold uppercase flex items-center gap-1 w-fit",
                              res.status === 'valid' ? "border-accent text-accent" : 
                              res.status === 'duplicate' ? "border-amber-500 text-amber-600" : "border-destructive text-destructive"
                            )}>
                              {res.status === 'valid' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                              {res.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[10px] max-w-[250px] text-muted-foreground italic leading-relaxed">
                            {res.errors.length > 0 ? res.errors[0] : (res.status === 'valid' ? `Syncing: ${res.updates.join(', ')}` : "Skipped.")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="h-full flex flex-col items-center justify-center space-y-6">
              <div className="relative"><div className="w-24 h-24 rounded-full border-4 border-muted border-t-primary animate-spin" /><div className="absolute inset-0 flex items-center justify-center"><Database className="w-8 h-8 text-primary animate-pulse" /></div></div>
              <div className="text-center space-y-2"><h3 className="text-xl font-bold">Synchronizing Tenant Data...</h3><p className="text-sm text-muted-foreground animate-pulse">Batch operations in progress.</p></div>
            </div>
          )}

          {step === 'results' && (
            <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 rounded-[2rem] bg-accent/10 flex items-center justify-center text-accent shadow-inner"><CheckCircle2 className="w-10 h-10" /></div>
              <div className="text-center space-y-2"><h3 className="text-3xl font-bold">Import Finalized</h3><p className="text-muted-foreground">Directory updated successfully for {churchId}.</p></div>
              <div className="grid grid-cols-4 gap-6 w-full max-w-2xl bg-muted/10 p-8 rounded-3xl border text-center">
                 <div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Rows</p><p className="text-2xl font-bold">{importStats.total}</p></div>
                 <div><p className="text-[10px] font-bold text-accent uppercase mb-1">Success</p><p className="text-2xl font-bold text-accent">{importStats.success}</p></div>
                 <div><p className="text-[10px] font-bold text-destructive uppercase mb-1">Errors</p><p className="text-2xl font-bold text-destructive">{importStats.failed}</p></div>
                 <div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Skipped</p><p className="text-2xl font-bold">{importStats.skipped}</p></div>
              </div>
              <Button onClick={() => { setIsOpen(false); resetState(); }} className="rounded-xl h-11 px-12 bg-primary">Done</Button>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/10 border-t">
          <p className="text-[10px] text-muted-foreground flex items-center gap-2">
            <Layers className="w-3 h-3 text-accent" />
            Security: Tenant isolation enforced. Imports affect only {churchId}.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
