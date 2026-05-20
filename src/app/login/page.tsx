"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
} from "firebase/auth";
import { useAuth, useFirestore } from "@/firebase";
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs, limit } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Church, Mail, Lock, ShieldCheck, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";

const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];

const AVAILABLE_MODULES = [
  { id: "members", label: "Members Management" },
  { id: "attendance", label: "Attendance Tracking" },
  { id: "events", label: "Event Planning" },
  { id: "finances", label: "Financial Records" },
  { id: "communication", label: "AI Communications" },
  { id: "insights", label: "Pastoral Insights" },
  { id: "reports", label: "Detailed Reports" },
];

const CrossIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="w-5 h-5 text-primary"
  >
    <path d="M12 3v18M8 8h8" />
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
  const [selectedModules, setSelectedModules] = useState<string[]>(["members", "attendance"]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeChurch, setActiveChurch] = useState<any>(null);
  const [isFetchingChurch, setIsFetchingChurch] = useState(!!tenantSlug);

  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (tenantSlug) {
      const q = query(collection(db, "churches"), where("slug", "==", tenantSlug.toLowerCase().trim()), limit(1));
      getDocs(q).then(snap => {
        if (!snap.empty) {
          setActiveChurch({ ...snap.docs[0].data(), id: snap.docs[0].id });
        } else {
          toast({ title: "Ministry not found", description: `Tenant ID '${tenantSlug}' is invalid.`, variant: "destructive" });
        }
      }).finally(() => {
        setIsFetchingChurch(false);
      });
    }
  }, [tenantSlug, db, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
      router.push("/dashboard");
      toast({ title: "Access Granted", description: activeChurch ? `Logged into ${activeChurch.name}` : "Welcome back!" });
    } catch (error: any) {
      toast({ 
        title: "Login failed", 
        description: error.message, 
        variant: "destructive" 
      });
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
        plan: "Starter",
        mustChangePassword: false,
        registeredAt: serverTimestamp(),
        settings: {
          birthdaySmsEnabled: true,
          lowCreditAlertEnabled: true,
          dailyReportsEnabled: false
        }
      };

      const churchDocRef = doc(db, "churches", finalSlug);
      setDoc(churchDocRef, churchData)
        .then(() => {
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
        <Link href="/" className="flex items-center gap-2 justify-center mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/30">
            <CrossIcon />
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
            <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-t-xl rounded-b-none">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Register Ministry</TabsTrigger>
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
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Features to Enable</Label>
                  <div className="grid gap-2">
                    {AVAILABLE_MODULES.map((module) => (
                      <div key={module.id} className="flex items-center space-x-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                        <Checkbox 
                          id={module.id} 
                          checked={selectedModules.includes(module.id)}
                          onCheckedChange={() => handleModuleToggle(module.id)}
                        />
                        <label htmlFor={module.id} className="text-sm font-medium leading-none cursor-pointer flex-1">
                          {module.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-6">
                <Button className="w-full bg-accent text-accent-foreground h-11 rounded-xl" type="submit" disabled={isLoading}>
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
