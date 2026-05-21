"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Church, 
  User, 
  Phone, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft,
  Sparkles,
  Heart,
  ChevronDown,
  Check,
  Plus
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore } from "@/firebase";
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

const CATHOLIC_SOCIETIES = [
  "Knights of Columbus",
  "Catholic Women Association",
  "Catholic Youth Organization",
  "Sacred Heart of Jesus",
  "St. Vincent de Paul",
  "Legion of Mary",
  "Charismatic Renewal",
  "Christian Mothers"
];

const DEPARTMENTS = [
  "Music",
  "Youth",
  "Media",
  "Children",
  "Welfare",
  "Ushering",
  "Evangelism"
];

export default function PublicRegistrationPage() {
  const params = useParams();
  const slug = params.slug as string;
  const db = useFirestore();
  const { toast } = useToast();

  const [church, setChurch] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [otherSocietyInput, setOtherSocietyInput] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    gender: "Male",
    dateOfBirth: "",
    department: "Music",
    societies: [] as string[]
  });

  useEffect(() => {
    async function fetchChurch() {
      try {
        const q = query(collection(db, "churches"), where("slug", "==", slug), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setChurch({ ...snap.docs[0].data(), id: snap.docs[0].id });
        }
      } catch (error) {
        console.error("Error fetching church:", error);
      } finally {
        setIsLoading(false);
      }
    }
    if (slug) fetchChurch();
  }, [slug, db]);

  const toggleSociety = (society: string) => {
    setFormData(prev => ({
      ...prev,
      societies: prev.societies.includes(society)
        ? prev.societies.filter(s => s !== society)
        : [...prev.societies, society]
    }));
  };

  const handleAddCustomSociety = () => {
    const val = otherSocietyInput.trim();
    if (!val) return;
    if (!formData.societies.includes(val)) {
      setFormData(prev => ({
        ...prev,
        societies: [...prev.societies, val]
      }));
    }
    setOtherSocietyInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.dateOfBirth || !church) {
      toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const membersRef = collection(db, "churches", church.id, "members");
      await addDoc(membersRef, {
        ...formData,
        status: "Active",
        joined: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        photo: `https://picsum.photos/seed/${Math.random()}/100/100`
      });
      setIsSuccess(true);
    } catch (error) {
      toast({ title: "Registration Failed", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCatholic = church?.denomination === 'Catholic';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!church) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <h1 className="text-4xl font-bold mb-4">Ministry Not Found</h1>
        <Link href="/">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Home</Button>
        </Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full glass border-accent/20 text-center py-12">
          <CardContent className="space-y-6">
            <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-12 h-12 text-accent" />
            </div>
            <h1 className="text-3xl font-bold">Welcome Home!</h1>
            <p className="text-muted-foreground">Registration with {church.name} complete.</p>
            <Button onClick={() => window.location.reload()} variant="outline">Register Another Member</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative py-12 px-6 overflow-hidden">
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="text-center mb-10 space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">{church.name}</h1>
          <p className="text-muted-foreground">Join our digital congregation.</p>
        </div>

        <Card className="glass border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Member Registration</CardTitle>
              <CardDescription>Enter your details correctly. Birth date format must be YYYY-MM-DD.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    placeholder="e.g. Ama Mensah"
                    className="bg-white/5"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input 
                      placeholder="024XXXXXXX"
                      className="bg-white/5"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                      <SelectTrigger className="bg-white/5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass">
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input 
                      type="date"
                      className="bg-white/5"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={formData.department} onValueChange={(v) => setFormData({...formData, department: v})}>
                      <SelectTrigger className="bg-white/5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass">
                        {DEPARTMENTS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isCatholic && (
                  <div className="space-y-2">
                    <Label>Societies & Groups</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-between bg-white/5 border-white/10 h-11 px-3 text-left font-normal"
                        >
                          <span className="truncate">
                            {formData.societies.length > 0 ? `${formData.societies.length} Selected` : "Select Societies"}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 glass overflow-hidden" align="start">
                         <div className="flex flex-col max-h-[350px]">
                           <ScrollArea className="flex-1">
                             <div className="p-2 space-y-1">
                               {/* Standard List */}
                               {CATHOLIC_SOCIETIES.map(society => {
                                 const isSelected = formData.societies.includes(society);
                                 return (
                                   <div 
                                     key={society} 
                                     className={cn(
                                       "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                                       isSelected ? "bg-primary/20 text-primary" : "hover:bg-white/5"
                                     )}
                                     onClick={() => toggleSociety(society)}
                                   >
                                     <div className={cn(
                                       "w-4 h-4 border rounded flex items-center justify-center transition-colors",
                                       isSelected ? "bg-primary border-primary" : "border-white/20"
                                     )}>
                                       {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                     </div>
                                     <span className="text-xs">{society}</span>
                                   </div>
                                 );
                               })}

                               {/* Custom Ones Already Selected */}
                               {formData.societies.filter(s => !CATHOLIC_SOCIETIES.includes(s)).map(society => (
                                 <div 
                                   key={society} 
                                   className="flex items-center gap-2 p-2 rounded-lg cursor-pointer bg-primary/20 text-primary"
                                   onClick={() => toggleSociety(society)}
                                 >
                                   <div className="w-4 h-4 border rounded border-primary bg-primary flex items-center justify-center">
                                     <Check className="h-3 w-3 text-primary-foreground" />
                                   </div>
                                   <span className="text-xs">{society}</span>
                                 </div>
                               ))}
                             </div>
                           </ScrollArea>

                           {/* Add Custom Input - Pinned at bottom */}
                           <div className="p-3 border-t border-white/10 bg-muted/20 space-y-2">
                              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Add Other Society</Label>
                              <div className="flex gap-2">
                                <Input 
                                  placeholder="Enter name"
                                  value={otherSocietyInput}
                                  onChange={(e) => setOtherSocietyInput(e.target.value)}
                                  className="h-8 text-xs bg-white/10"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddCustomSociety();
                                    }
                                  }}
                                />
                                <Button size="sm" className="h-8 w-8 p-0" onClick={handleAddCustomSociety}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                           </div>
                         </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="pt-6">
              <Button 
                type="submit" 
                className="w-full bg-primary text-primary-foreground h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Heart className="w-5 h-5 mr-2" />}
                Join Congregation
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
