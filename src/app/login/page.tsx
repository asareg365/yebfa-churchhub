"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
} from "firebase/auth";
import { useAuth, useUser } from "@/firebase";
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Loader2, Church, Mail, Lock, ShieldCheck, Hash, UserCheck, Sparkles, CheckCircle2, Search, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];

const AVAILABLE_MODULES = [
  { id: "members", label: "Members Management" },
  { id: "attendance", label: "Attendance Tracking" },
  { id: "events", label: "Event Planning" },
  { id: "finances", label: "Financial Records" },
  { id: "communication", label: "AI Communications" },
  { id: "analytics", label: "Pastoral Insights" },
  { id: "reports", label: "Detailed Reports" },
];

const PLAN_DEFAULTS: Record<string, string[]> = {
  Basic: ["members", "attendance"],
  Standard: ["members", "attendance", "events", "finances", "communication"],
  Premium: ["members", "attendance", "events", "finances", "communication", "analytics", "reports"],
};

const CrossIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className || "w-6 h-6 text-primary"}
  >
    <path d="M12 4v16M8 9h8" />
  </svg>
);

function LoginContent() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  const tenantSlug = searchParams.get("tenant");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [churchName, setChurchName] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("Basic");
  const [denomination, setDenomination] = useState("Pentecostal");
  const [selectedModules, setSelectedModules] = useState<string[]>(PLAN_DEFAULTS.Basic);
  const [isLoading, setIsLoading] = useState(false);
  const [activeChurch, setActiveChurch] = useState<any>(null);
  const [isFetchingChurch, setIsFetchingChurch] = useState(!!tenantSlug);
  
  const [allChurches, setAllChurches] = useState<any[]>([]);
  const [joiningChurchSlug, setJoiningChurchSlug] = useState("");
  const [isFetchingChurches, setIsFetchingChurches] = useState(false);

  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (tenantSlug && db) {
      const q = query(collection(db, "churches"), where("slug", "==", tenantSlug.toLowerCase().trim()), limit(1));
      getDocs(q).then(snap => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setActiveChurch({ ...data, id: snap.docs[0].id });
          setJoiningChurchSlug(data.slug);
        } else {
          toast({ title: "Ministry not found", description: `Tenant ID '${tenantSlug}' is invalid.`, variant: "destructive" });
        }
      }).catch(async (err) => {
        if (err.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: 'churches',
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
        }
      }).finally(() => {
        setIsFetchingChurch(false);
      });
    }
  }, [tenantSlug, db, toast]);

  useEffect(() => {
    async function fetchChurches() {
      if (!db) return;
      setIsFetchingChurches(true);
      try {
        const q = query(collection(db, "churches"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        const churches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllChurches(churches);
      } catch (err: any) {
        if (err.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: 'churches',
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
        }
      } finally {
        setIsFetchingChurches(false);
      }
    }
    fetchChurches();
  }, [db]);

  const handlePlanChange = (plan: string) => {
    setSelectedPlan(plan);
    setSelectedModules(PLAN_DEFAULTS[plan] || PLAN_DEFAULTS.Basic);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(
        auth,
        email.toLowerCase().trim(),
        password
      );

      // Preserve the church selected on the login URL.
      // This is required for Super Admin users who can access
      // multiple churches.
      if (tenantSlug) {
        localStorage.setItem(
          "global_admin_selected_tenant",
          tenantSlug.toLowerCase().trim()
        );
      } else {
        // Do not accidentally reuse an old church selection.
        localStorage.removeItem("global_admin_selected_tenant");
      }

      router.push("/dashboard");

      toast({
        title: "Access Granted",
        description: activeChurch
          ? `Logged into ${activeChurch.name}`
          : "Welcome back!",
      });
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndividualSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joiningChurchSlug) {
      toast({ title: "Selection Required", description: "Please select the ministry you are joining.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(
        auth,
        email.toLowerCase().trim(),
        password
      );

      const targetChurch = allChurches.find(
        c => c.slug === joiningChurchSlug
      );

      if (joiningChurchSlug) {
        localStorage.setItem(
          "global_admin_selected_tenant",
          joiningChurchSlug.toLowerCase().trim()
        );
      }

      toast({
        title: "Account Created",
        description: `You can now access ${
          targetChurch?.name || "your ministry"
        } if previously authorized`,
      });

      router.push("/dashboard");
    } catch (error: any) {
      toast({ title: "Signup Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').trim();
  };

  const handleModuleToggle = (moduleId: string) => {
    setSelectedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId) 
        : [...prev, moduleId]
    );
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSlug = slug || generateSlug(churchName);
    
    if (!churchName || !email || !password || !finalSlug) {
       toast({ title: "Required fields", description: "Please fill in all fields including Tenant ID.", variant: "destructive" });
       return;
    }

    setIsLoading(true);
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      
      const authorizedEmails = Array.from(new Set([
        normalizedEmail, 
        ...SUPER_ADMINS.map(email => email.toLowerCase().trim())
      ]));

      const churchData = {
        name: churchName,
        slug: finalSlug,
        adminEmail: normalizedEmail,
        adminEmails: authorizedEmails,
        enabledModules: selectedModules,
        status: "Pending",
        plan: selectedPlan,
        denomination: denomination,
        sms: {
          enabled: false,
          approved: false,
          status: "Pending",
          subscriptionStatus: 'pending',
          senderId: "YEBFA",
          displayName: churchName,
          credits: 0,
          stats: {
            sent: 0,
            failed: 0,
            refunded: 0,
            queued: 0
          }
        },
        subscription: {
          plan: selectedPlan,
          status: 'pending',
          renewalDate: '1st of Month',
          smsCredits: 0,
          smsUsed: 0
        },
        mustChangePassword: false,
        registeredAt: serverTimestamp(),
        settings: {
          birthdaySmsEnabled: true,
          lowCreditAlertEnabled: true,
          dailyReportsEnabled: false,
          timezone: "Africa/Accra"
        },
        smsTemplates: {
          birthday: "Happy Birthday {{name}}! 🎉 May God bless your new age richly. — {{churchName}}"
        }
      };

      const churchDocRef = doc(db, "churches", finalSlug);
      setDoc(churchDocRef, churchData)
        .then(() => {
          localStorage.setItem("global_admin_selected_tenant", finalSlug.toLowerCase().trim());
          toast({ 
            title: "Ministry Onboarded!", 
            description: `Tenant ID: ${finalSlug}. Account created successfully.` 
          });
          router.push("/dashboard");
        })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: churchDocRef.path,
            operation: 'create',
            requestResourceData: churchData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });

    } catch (error: any) {
      toast({ 
        title: "Registration failed", 
        description: error.message, 
        variant: "destructive" 
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-700">
        <Link href="/" className="flex flex-col items-center gap-4 justify-center mb-4">
          <div className="w-16 h-16 rounded-[1.25rem] bg-white flex items-center justify-center border border-border shadow-lg">
             <CrossIcon className="w-10 h-10 text-primary" />
          </div>
          <span className="font-headline text-lg font-bold tracking-tighter text-foreground">CHURCHHUB</span>
        </Link>
        {activeChurch ? (
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-primary">{activeChurch.name}</h1>
            <p className="text-muted-foreground">Authorized access portal.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground">Enterprise Ministry Portal</h1>
            <p className="text-muted-foreground">Secure access for your religious organization.</p>
          </>
        )}
      </div>

      <Card className="w-full max-w-md bg-white border-border shadow-2xl animate-in zoom-in-95 duration-500">
        <Tabs defaultValue={defaultTab} className="w-full">
          {!activeChurch && (
            <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-t-xl rounded-b-none h-auto">
              <TabsTrigger value="login" className="py-2">Login</TabsTrigger>
              <TabsTrigger value="join" className="py-2">Account</TabsTrigger>
              <TabsTrigger value="signup" className="py-2">Register</TabsTrigger>
            </TabsList>
          )}
          
          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <CardHeader>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>Enter your credentials to access {activeChurch?.name || "the dashboard"}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="admin@church.org" 
                      className="pl-10 bg-white" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="password" 
                      type="password" 
                      className="pl-10 bg-white" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button className="w-full bg-primary text-primary-foreground h-11 rounded-xl" type="submit" disabled={isLoading || isFetchingChurch}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In to Hub"}
                </Button>
                {activeChurch && (
                  <Button variant="link" onClick={() => router.push("/login")} className="text-xs text-muted-foreground">
                    Sign in to a different ministry
                  </Button>
                )}
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="join">
            <form onSubmit={handleIndividualSignup}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-accent" />
                  Account Access
                </CardTitle>
                <CardDescription>Create your account to join an authorized ministry.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Ministry to Join</Label>
                  <Select value={joiningChurchSlug} onValueChange={setJoiningChurchSlug}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder={isFetchingChurches ? "Loading ministries..." : "Select your ministry"} />
                    </SelectTrigger>
                    <SelectContent className="glass">
                      {allChurches.map((church) => (
                        <SelectItem key={church.slug} value={church.slug}>
                          {church.name}
                        </SelectItem>
                      ))}
                      {allChurches.length === 0 && !isFetchingChurches && (
                        <div className="p-2 text-xs text-muted-foreground text-center italic">No ministries found</div>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                    <Search className="w-3 h-3" /> Select the organization that invited you.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Your Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="email" 
                      placeholder="authorized-email@example.com" 
                      className="pl-10 bg-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Use the exact email authorized by your administrator.</p>
                </div>
                <div className="space-y-2">
                  <Label>Create Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="password" 
                      className="pl-10 bg-white"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full bg-accent text-accent-foreground h-11 rounded-xl" type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup}>
              <CardHeader>
                <CardTitle>Register Ministry</CardTitle>
                <CardDescription>Launch your church on Yebfa ChurchHub.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="churchName">Church / Ministry Name</Label>
                    <div className="relative">
                      <Church className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="churchName" 
                        placeholder="Grace Community Sanctuary" 
                        className="pl-10 bg-white" 
                        value={churchName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setChurchName(val);
                          setSlug(generateSlug(val));
                        }}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-slug">Tenant ID (Slug)</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="signup-slug" 
                        placeholder="grace-sanctuary" 
                        className="pl-10 bg-white font-mono" 
                        value={slug}
                        onChange={(e) => setSlug(generateSlug(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Subscription Tier</Label>
                      <Select value={selectedPlan} onValueChange={handlePlanChange}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select a plan" />
                        </SelectTrigger>
                        <SelectContent className="glass">
                          <SelectItem value="Basic">Starter / Basic (100 SMS)</SelectItem>
                          <SelectItem value="Standard">Ministry Growth (1,000 SMS)</SelectItem>
                          <SelectItem value="Premium">Enterprise (10,000 SMS)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Denomination</Label>
                      <Select value={denomination} onValueChange={setDenomination}>
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="glass">
                          <SelectItem value="Pentecostal">Pentecostal</SelectItem>
                          <SelectItem value="Catholic">Catholic</SelectItem>
                          <SelectItem value="Methodist">Methodist</SelectItem>
                          <SelectItem value="Presbyterian">Presbyterian</SelectItem>
                          <SelectItem value="Baptist">Baptist</SelectItem>
                          <SelectItem value="Charismatic">Charismatic</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Admin Email</Label>
                    <Input 
                      id="signup-email" 
                      type="email" 
                      placeholder="admin@church.org" 
                      className="bg-white" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input 
                      id="signup-password" 
                      type="password" 
                      className="bg-white" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    Modules Included in {selectedPlan}
                    <ShieldCheck className="w-3 h-3 text-accent" />
                  </Label>
                  <div className="grid gap-2">
                    {AVAILABLE_MODULES.map((module) => {
                      const isRecommended = PLAN_DEFAULTS[selectedPlan].includes(module.id);
                      return (
                        <div 
                          key={module.id} 
                          className={cn(
                            "flex items-center space-x-3 p-3 rounded-xl transition-colors",
                            isRecommended ? "bg-accent/5 border border-accent/20" : "bg-muted/50 opacity-50 grayscale"
                          )}
                        >
                          <Checkbox 
                            id={module.id} 
                            checked={selectedModules.includes(module.id)}
                            onCheckedChange={() => handleModuleToggle(module.id)}
                            disabled={!isRecommended && selectedPlan !== "Premium"}
                          />
                          <label htmlFor={module.id} className="text-sm font-medium leading-none cursor-pointer flex-1">
                            {module.label}
                          </label>
                          {isRecommended && <CheckCircle2 className="w-3 h-3 text-accent" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-6">
                <Button className="w-full bg-primary text-primary-foreground h-11 rounded-xl" type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Register Ministry"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
      
      <p className="mt-8 text-sm text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Enterprise multi-tenant security active.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <LoginContent />
    </Suspense>
  );
}