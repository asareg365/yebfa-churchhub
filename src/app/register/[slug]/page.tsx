"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { 
  CheckCircle2, 
  Loader2, 
  ArrowLeft,
  Heart,
  ChevronDown,
  Check,
  Plus,
  Upload,
  Camera,
  AlertTriangle,
  UserCheck,
  FileBadge,
  Layers
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useFirestore } from "@/firebase";
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

const DEPARTMENTS = ["Music", "Youth", "Media", "Children", "Welfare", "Ushering", "Evangelism"];
const MARITAL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed", "Separated", "Other", "Prefer not to say"];
const EDUCATION_LEVEL_OPTIONS = [
  "No formal education", "Primary", "Junior High School", "Senior High School", 
  "Vocational/Technical", "Certificate", "Diploma", "Bachelor's Degree", 
  "Master's Degree", "Doctorate", "Other"
];

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default function PublicRegistrationPage() {
  const params = useParams();
  const slug = params.slug as string;
  const db = useFirestore();
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);

  const [church, setChurch] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const [formData, setFormData] = useState<any>({
    name: "",
    phone: "",
    gender: "Male",
    dateOfBirth: "",
    department: "Music",
    societies: [],
    photo: "",
    extendedProfile: {
      firstName: "", otherNames: "", lastName: "", placeOfBirth: "",
      maritalStatus: "Single", educationLevel: "Bachelor's Degree",
      baptism: { baptised: false, date: "" },
      confirmation: { confirmed: false, place: "", date: "" }
    }
  });

  const extendedEnabled = church?.settings?.extendedProfile?.enabled && church?.settings?.extendedProfile?.showInRegistration;

  useEffect(() => {
    async function fetchChurch() {
      try {
        const q = query(collection(db, "churches"), where("slug", "==", slug), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setChurch({ ...snap.docs[0].data(), id: snap.docs[0].id });
        }
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    }
    if (slug) fetchChurch();
  }, [slug, db]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, photo: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const calculateBirthdayKey = (dobString: string) => {
    if (!dobString) return "";
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return "";
    const month = String(dob.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dob.getUTCDate()).padStart(2, '0');
    return `${month}${day}`;
  };

  const calculateProfileStatus = (extended: any) => {
    if (!extendedEnabled) return null;
    if (!extended || !extended.firstName) return "Not Started";
    const requiredSet = ['firstName', 'lastName', 'placeOfBirth'];
    return requiredSet.every(f => !!extended[f]) ? "Complete" : "Incomplete";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateError(null);

    let finalName = formData.name;
    if (extendedEnabled && formData.extendedProfile.firstName) {
      finalName = `${formData.extendedProfile.firstName} ${formData.extendedProfile.otherNames || ''} ${formData.extendedProfile.lastName}`.replace(/\s+/g, ' ').trim();
    }

    if (!finalName || !formData.phone || !formData.dateOfBirth || !church) {
      toast({ title: "Validation Error", description: "Name, Phone, and DOB are required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const membersRef = collection(db, "churches", church.id, "members");
      const dupQuery = query(membersRef, where("phone", "==", formData.phone), limit(1));
      const dupSnap = await getDocs(dupQuery);
      
      if (!dupSnap.empty) {
        setDuplicateError("This phone number is already registered.");
        setIsSubmitting(false);
        return;
      }

      await addDoc(membersRef, {
        ...formData,
        name: finalName,
        profileStatus: calculateProfileStatus(formData.extendedProfile),
        birthdayKey: calculateBirthdayKey(formData.dateOfBirth),
        status: "Active",
        joined: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      });
      setIsSuccess(true);
    } catch (error) { toast({ title: "Registration Failed", variant: "destructive" }); } finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (!church) return <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"><h1 className="text-4xl font-bold mb-4">Ministry Not Found</h1><Link href="/"><Button variant="outline">Back to Home</Button></Link></div>;

  if (isSuccess) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full glass border-accent/20 text-center py-12">
        <CardContent className="space-y-6">
          <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-12 h-12 text-accent" /></div>
          <h1 className="text-3xl font-bold">Welcome Home!</h1>
          <p className="text-muted-foreground">Registration with {church.name} complete.</p>
          <Button onClick={() => window.location.reload()} variant="outline">Register Another Member</Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-12 px-6 overflow-hidden">
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="text-center mb-10 space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">{church.name}</h1>
          <p className="text-muted-foreground">Member Onboarding Portal</p>
        </div>

        <Card className="glass border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader><CardTitle>Registration Form</CardTitle><CardDescription>Please complete all required sections accurately.</CardDescription></CardHeader>
            <CardContent className="space-y-8">
              {duplicateError && <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm font-bold text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {duplicateError}</div>}

              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24 border-2 border-primary/20"><AvatarImage src={formData.photo} /><AvatarFallback>{getInitials(formData.name || formData.extendedProfile.firstName)}</AvatarFallback></Avatar>
                <div className="flex-1 space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Profile Identity</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => captureInputRef.current?.click()}><Camera className="w-4 h-4 mr-2 text-primary" /> Camera</Button>
                    <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4 mr-2 text-accent" /> Gallery</Button>
                  </div>
                  <input type="file" ref={captureInputRef} accept="image/*" capture="user" className="hidden" onChange={handleFileChange} />
                  <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest"><Layers className="w-4 h-4" /> Identification</div>
                {extendedEnabled ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>First Name</Label><Input value={formData.extendedProfile.firstName} onChange={e => setFormData({...formData, extendedProfile: {...formData.extendedProfile, firstName: e.target.value}})} required /></div>
                    <div className="space-y-2"><Label>Other Names</Label><Input value={formData.extendedProfile.otherNames} onChange={e => setFormData({...formData, extendedProfile: {...formData.extendedProfile, otherNames: e.target.value}})} /></div>
                    <div className="space-y-2"><Label>Last Name</Label><Input value={formData.extendedProfile.lastName} onChange={e => setFormData({...formData, extendedProfile: {...formData.extendedProfile, lastName: e.target.value}})} required /></div>
                  </div>
                ) : (
                  <div className="space-y-2"><Label>Full Name</Label><Input placeholder="e.g. Ama Mensah" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Phone</Label><Input placeholder="024XXXXXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required /></div>
                  <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={formData.dateOfBirth} onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} required /></div>
                </div>
              </div>

              {extendedEnabled && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-accent font-bold text-sm uppercase tracking-widest"><UserCheck className="w-4 h-4" /> Personal Details</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Place of Birth</Label><Input value={formData.extendedProfile.placeOfBirth} onChange={e => setFormData({...formData, extendedProfile: {...formData.extendedProfile, placeOfBirth: e.target.value}})} required /></div>
                      <div className="space-y-2">
                        <Label>Marital Status</Label>
                        <Select value={formData.extendedProfile.maritalStatus} onValueChange={v => setFormData({...formData, extendedProfile: {...formData.extendedProfile, maritalStatus: v}})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{MARITAL_STATUS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Education Level</Label>
                      <Select value={formData.extendedProfile.educationLevel} onValueChange={v => setFormData({...formData, extendedProfile: {...formData.extendedProfile, educationLevel: v}})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{EDUCATION_LEVEL_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/20 border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-sm"><FileBadge className="w-4 h-4 text-primary" /> Baptism</div>
                      <div className="flex items-center gap-2"><Label className="text-xs">Baptised?</Label><Switch checked={formData.extendedProfile.baptism.baptised} onCheckedChange={v => setFormData({...formData, extendedProfile: {...formData.extendedProfile, baptism: {...formData.extendedProfile.baptism, baptised: v}}})} /></div>
                    </div>
                    {formData.extendedProfile.baptism.baptised && (
                      <div className="animate-in fade-in slide-in-from-top-1"><Label className="text-xs">Date of Baptism</Label><Input type="date" value={formData.extendedProfile.baptism.date} onChange={e => setFormData({...formData, extendedProfile: {...formData.extendedProfile, baptism: {...formData.extendedProfile.baptism, date: e.target.value}}})} /></div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-muted/20 border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-sm"><UserCheck className="w-4 h-4 text-accent" /> Confirmation</div>
                      <div className="flex items-center gap-2"><Label className="text-xs">Confirmed?</Label><Switch checked={formData.extendedProfile.confirmation.confirmed} onCheckedChange={v => setFormData({...formData, extendedProfile: {...formData.extendedProfile, confirmation: {...formData.extendedProfile.confirmation, confirmed: v}}})} /></div>
                    </div>
                    {formData.extendedProfile.confirmation.confirmed && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
                        <div className="space-y-1"><Label className="text-xs">Place</Label><Input value={formData.extendedProfile.confirmation.place} onChange={e => setFormData({...formData, extendedProfile: {...formData.extendedProfile, confirmation: {...formData.extendedProfile.confirmation, place: e.target.value}}})} /></div>
                        <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={formData.extendedProfile.confirmation.date} onChange={e => setFormData({...formData, extendedProfile: {...formData.extendedProfile, confirmation: {...formData.extendedProfile.confirmation, date: e.target.value}}})} /></div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="space-y-2"><Label>Church Department</Label><Select value={formData.department} onValueChange={v => setFormData({...formData, department: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
            </CardContent>
            <CardFooter><Button type="submit" className="w-full bg-primary h-12 rounded-xl font-bold" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Heart className="w-5 h-5 mr-2" />} Join Congregation</Button></CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
