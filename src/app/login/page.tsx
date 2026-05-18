
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from "firebase/auth";
import { useAuth, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, Church, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import Link from "next/link";

function LoginContent() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [churchName, setChurchName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
      toast({ title: "Welcome back!" });
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!churchName || !email || !password) return;
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      const churchData = {
        name: churchName,
        adminEmail: email,
        adminUid: userCredential.user.uid,
        status: "Pending",
        plan: "Starter",
        registeredAt: serverTimestamp()
      };

      // Create a registration record for the church
      const churchesRef = collection(db, "churches");
      addDoc(churchesRef, churchData)
        .then(() => {
          toast({ 
            title: "Ministry account created!", 
            description: `Welcome to the Hub, ${churchName}. Your account is pending verification.` 
          });
          router.push("/dashboard");
        })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: churchesRef.path,
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

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/dashboard");
    } catch (error: any) {
      toast({ title: "Google sign-in failed", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent rounded-full blur-[120px]" />
      </div>

      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-700">
        <Link href="/" className="flex items-center gap-2 justify-center mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="text-primary font-bold text-xl">Y</span>
          </div>
          <span className="font-headline text-lg font-bold tracking-tighter text-white">CHURCHHUB</span>
        </Link>
        <h1 className="text-2xl font-bold">Enterprise Ministry Portal</h1>
        <p className="text-muted-foreground">Secure access for your religious organization.</p>
      </div>

      <Card className="w-full max-w-md glass border-white/10 shadow-2xl animate-in zoom-in-95 duration-500">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/5 p-1 rounded-t-xl rounded-b-none">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Register Ministry</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <CardHeader>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
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
                      className="pl-10 bg-white/5" 
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
                      className="pl-10 bg-white/5" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button className="w-full bg-primary text-primary-foreground h-11" type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                </Button>
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or continue with</span></div>
                </div>
                <Button variant="outline" className="w-full glass border-white/10" type="button" onClick={handleGoogleSignIn}>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google
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
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="churchName">Church / Ministry Name</Label>
                  <div className="relative">
                    <Church className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="churchName" 
                      placeholder="Grace Community Sanctuary" 
                      className="pl-10 bg-white/5" 
                      value={churchName}
                      onChange={(e) => setChurchName(e.target.value)}
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
                    className="bg-white/5" 
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
                    className="bg-white/5" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full bg-accent text-accent-foreground h-11" type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
      
      <p className="mt-8 text-sm text-muted-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        Advanced encryption and data isolation active.
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
