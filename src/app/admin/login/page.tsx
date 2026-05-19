
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAuth, useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2, Mail, Lock, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const auth = useAuth();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!userLoading && user && SUPER_ADMINS.includes(user.email?.toLowerCase() || "")) {
      router.push("/admin");
    }
  }, [user, userLoading, router]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
      const userEmail = userCredential.user.email?.toLowerCase() || "";
      
      if (SUPER_ADMINS.includes(userEmail)) {
        router.push("/admin");
        toast({ title: "Welcome, Administrator", description: "Access granted to the system portal." });
      } else {
        toast({ 
          title: "Access Denied", 
          description: "This portal is reserved for System Administrators.", 
          variant: "destructive" 
        });
      }
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

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent rounded-full blur-[120px]" />
      </div>

      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-700">
        <Link href="/" className="flex items-center gap-2 justify-center mb-6 hover:opacity-80 transition-opacity">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-medium">Back to Public Site</span>
        </Link>
        <div className="flex items-center gap-2 justify-center mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
            <ShieldCheck className="text-primary w-6 h-6" />
          </div>
          <span className="font-headline text-lg font-bold tracking-tighter text-white">SYSTEM ADMIN</span>
        </div>
        <h1 className="text-2xl font-bold">Secure Management Portal</h1>
        <p className="text-muted-foreground">Authorized System Personnel Only.</p>
      </div>

      <Card className="w-full max-w-md glass border-white/10 shadow-2xl animate-in zoom-in-95 duration-500">
        <form onSubmit={handleAdminLogin}>
          <CardHeader>
            <CardTitle>Administrator Sign In</CardTitle>
            <CardDescription>Enter your system credentials to manage the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">System Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@yebfa.com" 
                  className="pl-10 bg-white/5" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Security Key</Label>
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
          <CardFooter>
            <Button className="w-full bg-primary text-primary-foreground h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Identity"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <p className="mt-8 text-sm text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        System-wide encryption and audit logging active.
      </p>
    </div>
  );
}
