
"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  Cloud, 
  CreditCard, 
  Save, 
  Check, 
  Info, 
  Smartphone, 
  Trash2, 
  Loader2, 
  KeyRound,
  ShieldAlert,
  Lock,
  MessageSquare,
  Sun,
  Moon,
  Laptop
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUser, useFirestore, useCollection, useAuth } from "@/firebase";
import { doc, updateDoc, query, collection, where, limit } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const isForced = searchParams.get("force") === "true";

  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState(isForced ? "security" : "general");
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark" | "system">("dark");

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);

  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const [settings, setSettings] = useState({
    name: "",
    adminEmail: "",
    phone: "",
    birthdaySmsEnabled: true,
    lowCreditAlertEnabled: true,
    dailyReportsEnabled: false,
    senderId: "",
    theme: "dark" as "light" | "dark" | "system"
  });

  const [passwords, setPasswords] = useState({
    new: "",
    confirm: ""
  });

  useEffect(() => {
    if (currentChurch) {
      const dbTheme = currentChurch.settings?.theme || "dark";
      setSettings({
        name: currentChurch.name || "",
        adminEmail: currentChurch.adminEmail || "",
        phone: currentChurch.phone || "",
        birthdaySmsEnabled: currentChurch.settings?.birthdaySmsEnabled ?? true,
        lowCreditAlertEnabled: currentChurch.settings?.lowCreditAlertEnabled ?? true,
        dailyReportsEnabled: currentChurch.settings?.dailyReportsEnabled ?? false,
        senderId: currentChurch.settings?.senderId || "",
        theme: dbTheme
      });
      setCurrentTheme(dbTheme);
      applyTheme(dbTheme);
    }
  }, [currentChurch]);

  const applyTheme = (theme: "light" | "dark" | "system") => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  };

  const handleSave = () => {
    if (!currentChurch) return;
    setIsSaving(true);

    const docRef = doc(db, "churches", currentChurch.id);
    const updateData = {
      name: settings.name,
      phone: settings.phone,
      settings: {
        birthdaySmsEnabled: settings.birthdaySmsEnabled,
        lowCreditAlertEnabled: settings.lowCreditAlertEnabled,
        dailyReportsEnabled: settings.dailyReportsEnabled,
        senderId: settings.senderId,
        theme: settings.theme
      }
    };

    updateDoc(docRef, updateData)
      .then(() => {
        applyTheme(settings.theme);
        toast({ title: "Settings updated", description: "Your changes have been saved successfully." });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => setIsSaving(false));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (passwords.new.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters required.", variant: "destructive" });
      return;
    }

    setIsChangingPassword(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, passwords.new);
        
        if (currentChurch?.id) {
          const docRef = doc(db, "churches", currentChurch.id);
          await updateDoc(docRef, { mustChangePassword: false });
        }

        toast({ title: "Password changed", description: "Your security credentials have been updated." });
        setPasswords({ new: "", confirm: "" });
      }
    } catch (error: any) {
      toast({ 
        title: "Update failed", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const plans = [
    { name: "Basic", price: "99", description: "Essential tools for small congregations.", features: ["100 SMS/month", "1 church admin", "Basic attendance", "Member management"], current: currentChurch?.plan === "Basic" },
    { name: "Standard", price: "299", description: "Advanced features for growing ministries.", features: ["1,000 SMS/month", "Unlimited members", "Finance management", "AI Insights Lite"], current: currentChurch?.plan === "Standard" },
    { name: "Premium", price: "599", description: "Full suite for enterprise organizations.", features: ["Priority Support", "AI Analytics", "Unlimited Branches", "Custom Reports"], current: currentChurch?.plan === "Premium" }
  ];

  if (churchLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Settings</h2>
          <p className="text-muted-foreground">Manage your church configuration and platform preferences.</p>
        </div>
        {!isForced && (
          <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/80">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="general" className="rounded-xl px-6" disabled={isForced}>General</TabsTrigger>
          <TabsTrigger value="display" className="rounded-xl px-6" disabled={isForced}>Display</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-xl px-6" disabled={isForced}>Notifications</TabsTrigger>
          <TabsTrigger value="billing" className="rounded-xl px-6" disabled={isForced}>Billing</TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl px-6">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="animate-in fade-in-50 duration-500">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Church Information</CardTitle>
              <CardDescription>Update your basic organization details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Church Name</Label>
                  <Input 
                    placeholder="Enter church name" 
                    value={settings.name} 
                    onChange={(e) => setSettings({...settings, name: e.target.value})}
                    className="bg-white/5 border-white/10" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Organization Email</Label>
                  <Input 
                    disabled
                    value={settings.adminEmail} 
                    className="bg-white/5 border-white/10 opacity-50 cursor-not-allowed" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input 
                    placeholder="+233..." 
                    value={settings.phone}
                    onChange={(e) => setSettings({...settings, phone: e.target.value})}
                    className="bg-white/5 border-white/10" 
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    mNotify Sender ID
                  </Label>
                  <Input 
                    placeholder="e.g. HOPE-CHURCH" 
                    value={settings.senderId} 
                    onChange={(e) => setSettings({...settings, senderId: e.target.value.toUpperCase().slice(0, 11)})}
                    className="bg-white/5 border-white/10 font-mono" 
                  />
                  <p className="text-[10px] text-muted-foreground italic">Must be pre-approved on your mNotify account. Max 11 characters.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="display" className="animate-in fade-in-50 duration-500">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Choose how ChurchHub looks on your screen.</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={settings.theme} 
                onValueChange={(v: any) => setSettings({...settings, theme: v})}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <Label
                  htmlFor="theme-light"
                  className={cn(
                    "flex flex-col items-center justify-between rounded-2xl border-2 border-muted bg-white/5 p-4 hover:bg-white/10 cursor-pointer",
                    settings.theme === "light" && "border-primary"
                  )}
                >
                  <RadioGroupItem value="light" id="theme-light" className="sr-only" />
                  <Sun className="mb-3 h-6 w-6" />
                  <span className="text-sm font-semibold">Light</span>
                </Label>
                <Label
                  htmlFor="theme-dark"
                  className={cn(
                    "flex flex-col items-center justify-between rounded-2xl border-2 border-muted bg-white/5 p-4 hover:bg-white/10 cursor-pointer",
                    settings.theme === "dark" && "border-primary"
                  )}
                >
                  <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
                  <Moon className="mb-3 h-6 w-6" />
                  <span className="text-sm font-semibold">Dark</span>
                </Label>
                <Label
                  htmlFor="theme-system"
                  className={cn(
                    "flex flex-col items-center justify-between rounded-2xl border-2 border-muted bg-white/5 p-4 hover:bg-white/10 cursor-pointer",
                    settings.theme === "system" && "border-primary"
                  )}
                >
                  <RadioGroupItem value="system" id="theme-system" className="sr-only" />
                  <Laptop className="mb-3 h-6 w-6" />
                  <span className="text-sm font-semibold">System</span>
                </Label>
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="animate-in fade-in-50 duration-500">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Control how you and your members receive updates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-base">Automated Birthday SMS</Label>
                  <p className="text-sm text-muted-foreground">Send greetings to members on their birthday via mNotify.</p>
                </div>
                <Switch 
                  checked={settings.birthdaySmsEnabled} 
                  onCheckedChange={(checked) => setSettings({...settings, birthdaySmsEnabled: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-base">Low SMS Credit Alert</Label>
                  <p className="text-sm text-muted-foreground">Notify when mNotify credits fall below 500.</p>
                </div>
                <Switch 
                  checked={settings.lowCreditAlertEnabled} 
                  onCheckedChange={(checked) => setSettings({...settings, lowCreditAlertEnabled: checked})}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-base">Daily Attendance Reports</Label>
                  <p className="text-sm text-muted-foreground">Email summary of attendance each evening.</p>
                </div>
                <Switch 
                  checked={settings.dailyReportsEnabled} 
                  onCheckedChange={(checked) => setSettings({...settings, dailyReportsEnabled: checked})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6 animate-in fade-in-50 duration-500">
          <Alert className="glass-primary border-primary/30 py-6 rounded-3xl">
            <Smartphone className="h-6 w-6 text-primary" />
            <AlertTitle className="text-primary font-bold text-lg ml-2">Subscription Renewal via MoMo</AlertTitle>
            <AlertDescription className="mt-2 text-foreground/90 ml-2 text-base">
              To activate or renew your plan and recharge SMS credits, please send the plan cost via Mobile Money to 
              <span className="font-bold text-primary mx-1">0248472474</span>. 
              Use your <span className="font-bold underline italic">Church Name</span> as the reference.
              Accounts are typically approved within 1 hour of payment.
            </AlertDescription>
          </Alert>

          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.name} className={plan.current ? "glass border-primary/50 ring-1 ring-primary/20 scale-105" : "glass"}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription className="mt-1">{plan.description}</CardDescription>
                    </div>
                    {plan.current && <Badge className="bg-primary text-primary-foreground">Current Plan</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">GH₵{plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-accent" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full h-11 rounded-xl" variant={plan.current ? "outline" : "default"}>
                    {plan.current ? "Renew Plan" : `Upgrade to ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-6 animate-in fade-in-50 duration-500">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Security Credentials
              </CardTitle>
              <CardDescription>Update your ministry dashboard access password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input 
                    id="new-password"
                    type="password"
                    value={passwords.new}
                    onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                    className="bg-white/5 border-white/10"
                    placeholder="Min. 6 characters"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input 
                    id="confirm-password"
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                    className="bg-white/5 border-white/10"
                    placeholder="Repeat new password"
                    required
                  />
                </div>
                <Button type="submit" disabled={isChangingPassword} className="w-full bg-primary text-primary-foreground">
                  {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                  Update Access Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
