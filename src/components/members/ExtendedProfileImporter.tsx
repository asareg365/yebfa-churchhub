"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
  Search,
  ChevronDown
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
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, writeBatch, serverTimestamp, collection } from "firebase/firestore";
import { format, parse, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { useTenant } from "@/context/tenant-context";

interface ExtendedProfileImporterProps {
  churchId: string;
  members: any[];
}

type ImportStep = 'upload' | 'preview' | 'processing' | 'results';
type ImportMode = 'create' | 'update';

const DEPARTMENTS = ["Music", "Youth", "Media", "Children", "Welfare", "Ushering", "Evangelism"];

interface CSVRow {
  memberId: string;
  phoneNumber: string;
  firstName: string;
  otherNames: string;
  lastName: string;
  gender: string;
  DOB: string;
  placeOfBirth: string;
  maritalStatus: string;
  educationLevel: string;
  department: string;
  membershipStatus: string;
  dateJoined: string;
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

const parseAndValidateDate = (dateStr: string) => {
  if (!dateStr || !dateStr.trim()) return null;
  const cleanStr = dateStr.trim();
  
  let d = parse(cleanStr, 'yyyy-MM-dd', new Date());
  if (isValid(d) && format(d, 'yyyy-MM-dd') === cleanStr) return d;

  d = parse(cleanStr, 'dd/MM/yyyy', new Date());
  if (isValid(d)) {
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      if (d.getDate() === day && (d.getMonth() + 1) === month && d.getFullYear() === year) {
        return d;
      }
    }
  }
  
  return null;
};

const splitCSVLine = (line: string) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(v => v.trim().replace(/^"(.*)"$/, '$1'));
};

const HEADER_MAP: Record<string, string> = {
  'memberid': 'memberId',
  'phonenumber': 'phoneNumber',
  'phonenum': 'phoneNumber',
  'phone': 'phoneNumber',
  'firstname': 'firstName',
  'firstnam': 'firstName',
  'othernames': 'otherNames',
  'othernam': 'otherNames',
  'lastname': 'lastName',
  'lastnam': 'lastName',
  'gender': 'gender',
  'sex': 'gender',
  'dob': 'DOB',
  'dateofbirth': 'DOB',
  'placeofbirth': 'placeOfBirth',
  'placeofbir': 'placeOfBirth',
  'maritalstatus': 'maritalStatus',
  'marital': 'maritalStatus',
  'educationlevel': 'educationLevel',
  'education': 'educationLevel',
  'department': 'department',
  'dept': 'department',
  'membershipstatus': 'membershipStatus',
  'status': 'membershipStatus',
  'datejoined': 'dateJoined',
  'joined': 'dateJoined',
  'baptised': 'baptised',
  'baptismdate': 'baptismDate',
  'confirmed': 'confirmed',
  'confirmationplace': 'confirmationPlace',
  'confirmationdate': 'confirmationDate'
};

export function ExtendedProfileImporter({ churchId, members }: ExtendedProfileImporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>('upload');
  const [importMode, setImportMode] = useState<ImportMode>('update');
  const [rawRows, setRawRows] = useState<CSVRow[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0, skipped: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const db = useFirestore();

  const normalizePhone = (phone: string) => phone?.replace(/\D/g, "") || "";

  const resetState = () => {
    setStep('upload');
    setRawRows([]);
    setValidationResults([]);
    setImportStats({ total: 0, success: 0, failed: 0, skipped: 0 });
    setIsProcessing(false);
  };

  const downloadTemplate = () => {
    const headers = [
      "memberId", 
      "phoneNumber", 
      "firstName", 
      "otherNames", 
      "lastName", 
      "gender (Male/Female)",
      "DOB (DD/MM/YYYY)", 
      "placeOfBirth", 
      "maritalStatus", 
      "educationLevel", 
      "department",
      "membershipStatus (Active/Inactive)",
      "dateJoined (DD/MM/YYYY)",
      "baptised (Yes/No)", 
      "baptismDate (DD/MM/YYYY)", 
      "confirmed (Yes/No)", 
      "confirmationPlace", 
      "confirmationDate (DD/MM/YYYY)"
    ];

    const sampleRow = importMode === 'update' 
      ? ["ID_FROM_DASHBOARD", "0240000000", "John", "Kofi", "Doe", "Male", "15/05/1990", "Accra", "Married", "Bachelor's Degree", "Music", "Active", "01/01/2023", "Yes", "20/12/2010", "Yes", "Grace Sanctuary", "10/11/2015"]
      : ["", "0241234567", "Sarah", "Ama", "Mensah", "Female", "12/03/1995", "Kumasi", "Single", "Diploma", "Youth", "Active", "15/02/2024", "No", "", "No", "", ""];
    
    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `churchhub_master_${importMode}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(",").map(h => {
      const part = h.trim().split(/[ (]/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      return HEADER_MAP[part] || part;
    });
    
    return lines.slice(1).map(line => {
      const values = splitCSVLine(line);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      return row as CSVRow;
    });
  };

  const validateData = useCallback((rows: CSVRow[]) => {
    const results: ValidationResult[] = rows.map((row, index) => {
      const errors: string[] = [];
      const updates: string[] = [];
      let matchedMember = null;
      let status: ValidationResult['status'] = 'valid';

      const csvPhone = normalizePhone(row.phoneNumber);

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

      if (row.DOB) {
        const d = parseAndValidateDate(row.DOB);
        if (!d) { errors.push("Invalid DOB format. Use DD/MM/YYYY"); status = 'invalid'; }
        else updates.push("DOB");
      }

      if (row.dateJoined) {
        const d = parseAndValidateDate(row.dateJoined);
        if (!d) { errors.push("Invalid Joined Date"); status = 'invalid'; }
        else updates.push("Joined");
      }

      if (row.department) {
        if (!DEPARTMENTS.some(d => d.toLowerCase() === row.department.toLowerCase())) {
          errors.push(`Invalid Dept: ${row.department}`);
          status = 'invalid';
        } else updates.push("Dept");
      }

      if (row.gender) {
        if (!['male', 'female'].includes(row.gender.toLowerCase())) {
          errors.push("Gender must be Male or Female");
          status = 'invalid';
        } else updates.push("Gender");
      }

      if (row.baptised?.toLowerCase() === 'yes') {
        if (row.baptismDate) {
          const d = parseAndValidateDate(row.baptismDate);
          if (!d) { errors.push("Invalid Baptism Date"); status = 'invalid'; }
        }
        updates.push("Baptism");
      }

      if (row.confirmed?.toLowerCase() === 'yes') {
        if (row.confirmationDate) {
          const d = parseAndValidateDate(row.confirmationDate);
          if (!d) { errors.push("Invalid Confirmation Date"); status = 'invalid'; }
        }
        updates.push("Confirmation");
      }

      if (row.firstName || row.lastName) updates.push("Identity");
      if (row.placeOfBirth || row.maritalStatus) updates.push("Personal");
      if (row.membershipStatus) updates.push("Status");

      return { row: index + 1, data: row, matchedMember, status, errors, updates };
    });

    setValidationResults(results);
  }, [members, importMode]);

  useEffect(() => {
    if (rawRows.length > 0) {
      validateData(rawRows);
    }
  }, [importMode, members, validateData, rawRows]);

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
      setRawRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
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
        
        const updateObj: any = { updatedAt: serverTimestamp() };

        if (data.DOB) {
          const d = parseAndValidateDate(data.DOB);
          if (d) {
            const formatted = format(d, 'yyyy-MM-dd');
            ext.dateOfBirth = formatted;
            updateObj.dateOfBirth = formatted;
            // Calculate birthday key MMDD
            updateObj.birthdayKey = format(d, 'MMdd');
          }
        }

        if (data.dateJoined) {
          const d = parseAndValidateDate(data.dateJoined);
          if (d) updateObj.joined = format(d, 'yyyy-MM-dd');
        }

        if (data.department) {
          const resolvedDept = DEPARTMENTS.find(d => d.toLowerCase() === data.department.toLowerCase());
          if (resolvedDept) updateObj.department = resolvedDept;
        }

        if (data.membershipStatus) {
          const status = data.membershipStatus.toLowerCase().includes('inactive') ? 'Inactive' : 'Active';
          updateObj.status = status;
        }

        if (data.gender) {
          const gender = data.gender.toLowerCase().startsWith('m') ? 'Male' : 'Female';
          updateObj.gender = gender;
        }

        if (data.baptised) {
          const isBaptised = data.baptised.toLowerCase() === 'yes';
          const d = data.baptismDate ? parseAndValidateDate(data.baptismDate) : null;
          ext.baptism = {
            baptised: isBaptised,
            date: d ? format(d, 'yyyy-MM-dd') : (ext.baptism?.date || "")
          };
        }

        if (data.confirmed) {
          const isConfirmed = data.confirmed.toLowerCase() === 'yes';
          const d = data.confirmationDate ? parseAndValidateDate(data.confirmationDate) : null;
          ext.confirmation = {
            confirmed: isConfirmed,
            place: data.confirmationPlace || (ext.confirmation?.place || ""),
            date: d ? format(d, 'yyyy-MM-dd') : (ext.confirmation?.date || "")
          };
        }

        const profileStatus = (['firstName', 'lastName', 'placeOfBirth'].every(f => !!ext[f])) ? "Complete" : "Incomplete";
        const finalName = `${ext.firstName || ''} ${ext.otherNames || ''} ${ext.lastName || ''}`.replace(/\s+/g, ' ').trim() || res.matchedMember?.name || data.firstName;

        updateObj.extendedProfile = ext;
        updateObj.name = finalName;
        updateObj.profileStatus = profileStatus;

        if (importMode === 'update') {
          batch.update(doc(membersRef, res.matchedMember.id), updateObj);
        } else {
          updateObj.phone = data.phoneNumber;
          updateObj.status = updateObj.status || "Active";
          updateObj.joined = updateObj.joined || format(new Date(), 'yyyy-MM-dd');
          updateObj.createdAt = serverTimestamp();
          batch.set(doc(membersRef), updateObj);
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
    const csvContent = [
      headers.join(","), 
      ...errorRows.map(r => [
        r.row, 
        r.data.memberId, 
        r.data.phoneNumber, 
        r.status.toUpperCase(), 
        `"${r.errors.join('; ')}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `import_errors_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if(!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5">
          <FileUp className="w-4 h-4 mr-2" /> Master CSV Import
        </Button>
      </DialogTrigger>
      <DialogContent className="glass max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-muted/20 border-b shrink-0">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Member Master Importer
              </DialogTitle>
              <DialogDescription>Universal field mapping for registration and updates.</DialogDescription>
            </div>
            {step !== 'upload' && !isProcessing && (
              <Button variant="ghost" size="sm" onClick={resetState} className="h-8">
                <ArrowLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-background/50">
          {step === 'upload' && (
            <div className="flex flex-col items-center py-12 px-6 space-y-8 animate-in fade-in duration-500">
              <Card className="w-full max-w-md p-6 glass border-primary/20 shadow-2xl">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Selection Mode</Label>
                    <select 
                      value={importMode} 
                      onChange={(e) => setImportMode(e.target.value as ImportMode)}
                      className="w-full h-11 px-4 rounded-xl bg-muted/30 border border-border text-sm font-bold focus:ring-2 focus:ring-primary focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="create">Register New Members (Initial Load)</option>
                      <option value="update">Update Existing Profiles (Maintenance)</option>
                    </select>
                  </div>
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                    <p className="text-xs text-primary font-bold flex items-center gap-2 uppercase tracking-widest">
                      {importMode === 'update' ? <Search className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                      {importMode === 'update' ? "Maintenance Mode" : "Bulk Registration"}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                      {importMode === 'update' 
                        ? "Updates all fields including Dept, Status, and Extended Data. Match by ID or unique Phone." 
                        : "Creates new records. Full names will be constructed from structured name columns."}
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
                <div className="flex flex-col items-center p-8 rounded-[2rem] bg-muted/20 border-2 border-dashed border-border hover:border-primary/40 transition-all cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                  <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-4">
                    <DownloadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Upload Master CSV</h3>
                  <Input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                  <Button variant="outline" className="rounded-xl px-8 h-11">Browse Files</Button>
                </div>

                <div className="flex flex-col items-center p-8 rounded-[2rem] bg-accent/5 border border-accent/10 hover:border-accent/30 transition-all">
                  <div className="h-16 w-16 rounded-3xl bg-accent/10 flex items-center justify-center text-accent mb-4">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Get Master Template</h3>
                  <Button onClick={downloadTemplate} className="rounded-xl px-8 h-11 bg-accent text-white">Full Schema CSV</Button>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col p-6 space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-wrap gap-4 items-center justify-between bg-muted/20 p-6 rounded-3xl border shadow-sm">
                <div className="flex gap-8">
                  <div className="text-center"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Rows</p><p className="text-2xl font-bold">{validationResults.length}</p></div>
                  <div className="text-center"><p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">Valid</p><p className="text-2xl font-bold text-accent">{validationResults.filter(r => r.status === 'valid').length}</p></div>
                  <div className="text-center"><p className="text-[10px] font-bold text-destructive uppercase tracking-wider mb-1">Errors</p><p className="text-2xl font-bold text-destructive">{validationResults.filter(r => r.status !== 'valid').length}</p></div>
                </div>
                <div className="flex gap-3">
                  {validationResults.some(r => r.status !== 'valid') && (
                    <Button variant="outline" onClick={downloadErrorLog} className="rounded-xl h-11 px-6 text-destructive border-destructive/20 hover:bg-destructive/5 font-bold">Error Report</Button>
                  )}
                  <Button onClick={executeImport} className="rounded-xl h-11 px-10 bg-primary font-bold shadow-lg shadow-primary/20" disabled={!validationResults.some(r => r.status === 'valid')}>
                    <ClipboardCheck className="w-4 h-4 mr-2" /> Commit {importMode === 'create' ? 'Registration' : 'Updates'}
                  </Button>
                </div>
              </div>

              <div className="border rounded-3xl overflow-hidden shadow-inner bg-card">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-20">
                      <TableRow>
                        <TableHead className="w-[50px] text-[10px] font-bold uppercase py-4">Row</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase py-4">Identification</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase py-4">Status</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase py-4">Fields to Map</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResults.map((res) => (
                        <TableRow key={res.row} className="hover:bg-muted/5">
                          <TableCell className="text-xs font-mono font-bold text-muted-foreground">{res.row}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-bold text-sm">{res.matchedMember?.name || `${res.data.firstName} ${res.data.lastName}`}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">{res.data.phoneNumber || res.data.memberId}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-bold uppercase flex items-center gap-1 w-fit",
                              res.status === 'valid' ? "border-accent text-accent bg-accent/5" : "border-destructive text-destructive bg-destructive/5"
                            )}>
                              {res.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[10px] max-w-[250px] text-muted-foreground italic font-medium">
                            {res.errors.length > 0 ? res.errors[0] : (res.status === 'valid' ? `Mapping: ${res.updates.join(', ')}` : "No change.")}
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
            <div className="flex flex-col items-center justify-center py-24 space-y-6">
              <div className="relative"><div className="w-24 h-24 rounded-full border-4 border-muted border-t-primary animate-spin" /><div className="absolute inset-0 flex items-center justify-center"><Database className="w-8 h-8 text-primary animate-pulse" /></div></div>
              <div className="text-center space-y-2"><h3 className="text-xl font-bold">Writing Master Records...</h3><p className="text-sm text-muted-foreground animate-pulse">Processing multi-field synchronization.</p></div>
            </div>
          )}

          {step === 'results' && (
            <div className="flex flex-col items-center py-12 px-6 space-y-8 animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 rounded-[2rem] bg-accent/10 flex items-center justify-center text-accent shadow-inner"><CheckCircle2 className="w-10 h-10" /></div>
              <div className="text-center space-y-2"><h3 className="text-3xl font-bold">Batch Complete</h3><p className="text-muted-foreground">All master fields have been synchronized for this tenant.</p></div>
              <div className="grid grid-cols-4 gap-6 w-full max-w-2xl bg-muted/10 p-8 rounded-[2rem] border text-center shadow-sm">
                 <div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total</p><p className="text-2xl font-bold">{importStats.total}</p></div>
                 <div><p className="text-[10px] font-bold text-accent uppercase mb-1">Success</p><p className="text-2xl font-bold text-accent">{importStats.success}</p></div>
                 <div><p className="text-[10px] font-bold text-destructive uppercase mb-1">Failed</p><p className="text-2xl font-bold text-destructive">{importStats.failed}</p></div>
                 <div><p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Skipped</p><p className="text-2xl font-bold">{importStats.skipped}</p></div>
              </div>
              <Button onClick={() => { setIsOpen(false); resetState(); }} className="rounded-xl h-12 px-12 bg-primary font-bold shadow-lg shadow-primary/20">Finish and Close</Button>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/10 border-t shrink-0">
          <p className="text-[10px] text-muted-foreground flex items-center gap-2 font-medium">
            <Layers className="w-3 h-3 text-accent" />
            Master Template v2.0: Supports Department, Status, and full Extended Profile mapping.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
