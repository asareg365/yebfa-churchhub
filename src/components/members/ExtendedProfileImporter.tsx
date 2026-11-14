"use client";

import { useState, useMemo, useRef } from "react";
import { 
  FileUp, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  History, 
  FileText,
  ArrowRight,
  ArrowLeft,
  X,
  Database,
  UserCheck,
  ClipboardCheck,
  DownloadCloud
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
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, writeBatch, serverTimestamp, increment } from "firebase/firestore";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";

interface ExtendedProfileImporterProps {
  churchId: string;
  members: any[];
}

type ImportStep = 'upload' | 'preview' | 'processing' | 'results';

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
  status: 'valid' | 'invalid' | 'conflict' | 'not_found' | 'ambiguous';
  errors: string[];
  updates: string[];
}

export function ExtendedProfileImporter({ churchId, members }: ExtendedProfileImporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0, skipped: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const db = useFirestore();

  const normalizePhone = (phone: string) => phone?.replace(/\D/g, "") || "";

  const resetState = () => {
    setStep('upload');
    setCsvData([]);
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
    const sampleRow = [
      "ID_FROM_DASHBOARD", "0240000000", "John", "Kofi", "Doe", 
      "15/05/1990", "Accra", "Married", "Bachelor's Degree", 
      "Yes", "20/12/2010", "Yes", "Grace Sanctuary", "10/11/2015"
    ];
    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "member_extended_profile_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
      // Robust comma splitting with support for quoted strings
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
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast({ title: "Invalid File", description: "CSV file is empty or formatted incorrectly.", variant: "destructive" });
        return;
      }
      setCsvData(parsed);
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
        if (phoneMatches.length === 1) {
          matchedMember = phoneMatches[0];
        } else if (phoneMatches.length > 1) {
          status = 'ambiguous';
          errors.push(`Multiple members found with phone: ${row.phoneNumber}`);
        }
      }

      if (!matchedMember && status !== 'ambiguous') {
        status = 'not_found';
        errors.push("No matching member found by ID or Phone.");
      }

      // 2. Conflict Check
      if (matchedMember && row.memberId && row.memberId !== matchedMember.id) {
        status = 'conflict';
        errors.push(`Conflict: ID matches ${matchedMember.name} but CSV ID is ${row.memberId}`);
      }

      // 3. Field Validation
      if (matchedMember) {
        if (row.firstName || row.lastName) updates.push("Identity");
        if (row.dateOfBirth) {
          try {
            parse(row.dateOfBirth, 'dd/MM/yyyy', new Date());
            updates.push("DOB");
          } catch (e) { errors.push("Invalid DOB format (Expected DD/MM/YYYY)"); status = 'invalid'; }
        }
        if (row.maritalStatus || row.educationLevel || row.placeOfBirth) updates.push("Personal");
        if (row.baptised?.toLowerCase() === 'yes') updates.push("Baptism");
        if (row.confirmed?.toLowerCase() === 'yes') updates.push("Confirmation");
      }

      return { row: index + 1, data: row, matchedMember, status: status === 'valid' && errors.length > 0 ? 'invalid' : status, errors, updates };
    });

    setValidationResults(results);
    setStep('preview');
  };

  const executeImport = async () => {
    const validUpdates = validationResults.filter(r => (r.status === 'valid' || r.status === 'ambiguous' === false) && r.matchedMember);
    if (validUpdates.length === 0) return;

    setIsProcessing(true);
    setStep('processing');
    
    let successCount = 0;
    let failedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < validUpdates.length; i += batchSize) {
      const chunk = validUpdates.slice(i, i + batchSize);
      const batch = writeBatch(db);

      chunk.forEach(res => {
        const memberRef = doc(db, "churches", churchId, "members", res.matchedMember.id);
        const { data } = res;

        // Structured update to avoid erasing existing data
        const extendedProfile: any = { ...res.matchedMember.extendedProfile };
        
        if (data.firstName) extendedProfile.firstName = data.firstName;
        if (data.otherNames) extendedProfile.otherNames = data.otherNames;
        if (data.lastName) extendedProfile.lastName = data.lastName;
        if (data.placeOfBirth) extendedProfile.placeOfBirth = data.placeOfBirth;
        if (data.maritalStatus) extendedProfile.maritalStatus = data.maritalStatus;
        if (data.educationLevel) extendedProfile.educationLevel = data.educationLevel;
        
        if (data.dateOfBirth) {
          const parsedDob = parse(data.dateOfBirth, 'dd/MM/yyyy', new Date());
          extendedProfile.dateOfBirth = format(parsedDob, 'yyyy-MM-dd');
        }

        if (data.baptised) {
          extendedProfile.baptism = {
            baptised: data.baptised.toLowerCase() === 'yes',
            date: data.baptismDate ? format(parse(data.baptismDate, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd') : ""
          };
        }

        if (data.confirmed) {
          extendedProfile.confirmation = {
            confirmed: data.confirmed.toLowerCase() === 'yes',
            place: data.confirmationPlace || "",
            date: data.confirmationDate ? format(parse(data.confirmationDate, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd') : ""
          };
        }

        // Calculate profile completion
        const requiredSet = ['firstName', 'lastName', 'placeOfBirth'];
        const isComplete = requiredSet.every(field => !!extendedProfile[field]);
        const profileStatus = isComplete ? "Complete" : "Incomplete";

        // Auto-sync primary name
        const finalName = `${extendedProfile.firstName || ''} ${extendedProfile.otherNames || ''} ${extendedProfile.lastName || ''}`.replace(/\s+/g, ' ').trim() || res.matchedMember.name;

        batch.update(memberRef, {
          extendedProfile,
          name: finalName,
          profileStatus,
          updatedAt: serverTimestamp()
        });
      });

      try {
        await batch.commit();
        successCount += chunk.length;
      } catch (e) {
        failedCount += chunk.length;
      }
    }

    setImportStats({
      total: validationResults.length,
      success: successCount,
      failed: failedCount,
      skipped: validationResults.length - successCount - failedCount
    });
    setStep('results');
    setIsProcessing(false);
  };

  const downloadErrorLog = () => {
    const errorRows = validationResults.filter(r => r.status !== 'valid' || r.errors.length > 0);
    const headers = ["Row", "MemberID", "Phone", "Status", "Errors"];
    const rows = errorRows.map(r => [
      r.row, 
      r.data.memberId, 
      r.data.phoneNumber, 
      r.status.toUpperCase(), 
      `"${r.errors.join('; ')}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `import_error_log_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if(!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5">
          <FileUp className="w-4 h-4 mr-2" /> Bulk Extended Data
        </Button>
      </DialogTrigger>
      <DialogContent className="glass max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-muted/20 border-b">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Mass Extended Data Import
              </DialogTitle>
              <DialogDescription>
                Sync structured personal, baptism, and confirmation data for existing members.
              </DialogDescription>
            </div>
            {step !== 'upload' && !isProcessing && (
              <Button variant="ghost" size="sm" onClick={resetState} className="h-8">
                <ArrowLeft className="w-3 h-3 mr-1" /> Start Over
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6">
          {step === 'upload' && (
            <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
                <div className="flex flex-col items-center p-8 rounded-[2rem] bg-muted/20 border-2 border-dashed border-border hover:border-primary/40 transition-all cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                  <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-4">
                    <DownloadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Upload Data File</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">Drop your completed CSV here or click to browse files.</p>
                  <Input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                  <Button variant="outline" className="rounded-xl px-8">Browse CSV</Button>
                </div>

                <div className="flex flex-col items-center p-8 rounded-[2rem] bg-accent/5 border border-accent/10 hover:border-accent/30 transition-all">
                  <div className="h-16 w-16 rounded-3xl bg-accent/10 flex items-center justify-center text-accent mb-4">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Get Template</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">Download the correctly formatted spreadsheet with instructions.</p>
                  <Button onClick={downloadTemplate} className="rounded-xl px-8 bg-accent text-white">Download Template</Button>
                </div>
              </div>
              
              <div className="max-w-lg space-y-3 bg-primary/5 p-6 rounded-2xl border border-primary/10">
                <p className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <UserCheck className="w-3 h-3" /> Matching Logic Notice
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The system will match rows against your current directory using the <strong>memberId</strong> first, then normalized <strong>phoneNumber</strong>. Ambiguous matches or rows without a match will be flagged for review.
                </p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="h-full flex flex-col space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-wrap gap-4 items-center justify-between bg-muted/20 p-4 rounded-2xl border">
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Rows</p>
                    <p className="text-lg font-bold">{validationResults.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-accent uppercase tracking-widest">Valid Updates</p>
                    <p className="text-lg font-bold text-accent">{validationResults.filter(r => r.status === 'valid').length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-widest">Issues Found</p>
                    <p className="text-lg font-bold text-destructive">{validationResults.filter(r => r.status !== 'valid').length}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {validationResults.some(r => r.status !== 'valid') && (
                    <Button variant="outline" size="sm" onClick={downloadErrorLog} className="rounded-lg h-9 border-destructive/20 text-destructive hover:bg-destructive/5">
                      <AlertTriangle className="w-3 h-3 mr-1" /> View Warnings
                    </Button>
                  )}
                  <Button onClick={executeImport} className="rounded-xl h-9 bg-primary shadow-lg shadow-primary/20" disabled={!validationResults.some(r => r.status === 'valid')}>
                    <ClipboardCheck className="w-4 h-4 mr-2" /> Commit Valid Updates
                  </Button>
                </div>
              </div>

              <div className="border rounded-2xl overflow-hidden flex-1">
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-20">
                      <TableRow>
                        <TableHead className="w-[50px] text-[10px] font-bold uppercase">Row</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Member/Match</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Update Summary</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Action Plan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResults.map((res) => (
                        <TableRow key={res.row} className="hover:bg-muted/5 transition-colors border-border">
                          <TableCell className="text-xs font-mono font-bold text-muted-foreground">{res.row}</TableCell>
                          <TableCell>
                            {res.matchedMember ? (
                              <div className="space-y-0.5">
                                <p className="font-bold text-sm">{res.matchedMember.name}</p>
                                <p className="text-[10px] font-mono text-muted-foreground">{res.matchedMember.id}</p>
                              </div>
                            ) : (
                              <div className="space-y-0.5 opacity-50">
                                <p className="font-bold text-sm italic">{res.data.firstName} {res.data.lastName}</p>
                                <p className="text-[10px] font-mono">{res.data.phoneNumber}</p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {res.updates.map(u => (
                                <Badge key={u} variant="secondary" className="text-[8px] px-1 py-0 bg-primary/5 text-primary border-primary/10">{u}</Badge>
                              ))}
                              {res.updates.length === 0 && <span className="text-[10px] italic text-muted-foreground">No valid fields</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-bold uppercase flex items-center gap-1 w-fit",
                              res.status === 'valid' ? "border-accent/40 text-accent bg-accent/5" : 
                              res.status === 'not_found' ? "border-muted text-muted-foreground" : "border-destructive/40 text-destructive bg-destructive/5"
                            )}>
                              {res.status === 'valid' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                              {res.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[10px] max-w-[200px] text-muted-foreground italic leading-relaxed">
                            {res.errors.length > 0 ? res.errors[0] : (res.status === 'valid' ? "Ready to sync with profile." : "Skipping.")}
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
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-muted border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Database className="w-8 h-8 text-primary animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold">Synchronizing Records...</h3>
                <p className="text-sm text-muted-foreground animate-pulse">Batch-updating member profiles in secure chunks.</p>
              </div>
            </div>
          )}

          {step === 'results' && (
            <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 rounded-[2rem] bg-accent/10 flex items-center justify-center text-accent shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-3xl font-bold">Import Finalized</h3>
                <p className="text-muted-foreground">The digital directory has been successfully updated.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-2xl bg-muted/10 p-8 rounded-3xl border">
                 <div className="text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Processed</p>
                    <p className="text-2xl font-bold">{importStats.total}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Updated</p>
                    <p className="text-2xl font-bold text-accent">{importStats.success}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-widest mb-1">Errors</p>
                    <p className="text-2xl font-bold text-destructive">{importStats.failed}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Skipped</p>
                    <p className="text-2xl font-bold">{importStats.skipped}</p>
                 </div>
              </div>

              <div className="flex gap-4">
                {importStats.failed > 0 && (
                   <Button variant="outline" onClick={downloadErrorLog} className="rounded-xl h-11 border-destructive/20 text-destructive hover:bg-destructive/5">
                     <AlertTriangle className="w-4 h-4 mr-2" /> Download Error Log
                   </Button>
                )}
                <Button onClick={() => { setIsOpen(false); resetState(); }} className="rounded-xl h-11 px-12 bg-primary">Done</Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/10 border-t">
          <p className="text-[10px] text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3 text-accent" />
            Security: Import is restricted to authorized church administrators only.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
