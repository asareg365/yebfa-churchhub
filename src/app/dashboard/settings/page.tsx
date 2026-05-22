"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Settings, 
  Save, 
  Loader2, 
  KeyRound,
  Lock,
  MessageSquare,
  Sun,
  Moon,
  Laptop,
  Cake,
  Bell,
  Smartphone,
  Globe,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUser, useFirestore, useCollection, useAuth } from "@/firebase";
import { doc, updateDoc, query, collection, where, limit } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { cn } from "@/lib/utils";

const TIMEZONES = [
  "Africa/Accra",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Europe/London",
  "America/New_York",
  "UTC"
];

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

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);

  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const [settings, setSettings] = useState({
    name: "",
    phone: "",
    birthdaySmsEnabled: true,
    timezone: "Africa/Accra",
    birthdayTemplate: "Happy Birthday {{name}}! May God bless your new age with favor and joy. — {{churchName}}",
    lowCreditAlertEnabled: true,
    dailyReportsEnabled: false,
    senderId: "YEBFA",
    displayName: "",
    theme: "dark" as "light" | "dark" | "system"
  });

  const [passwords, setPasswords] = useState({
    new: "",
    confirm: ""
  });

  useEffect(() => {
    if (currentChurch) {
      setSettings({
        name: currentChurch.name || "",
        phone: currentChurch.phone || "",
        birthdaySmsEnabled: currentChurch.settings?.birthdaySmsEnabled ?? true,
        timezone: currentChurch.settings?.timezone || "Africa/Accra",
        birthdayTemplate: currentChurch.smsTemplates?.birthday || "Happy Birthday {{name}}! May God bless your new age with favor and joy. — {{churchName}}",
        lowCreditAlertEnabled: currentChurch.settings?.lowCreditAlertEnabled ?? true,
        dailyReportsEnabled: currentChurch.settings?.dailyReportsEnabled ?? false,
        senderId: currentChurch.sms?.senderId || "YEBFA",
        displayName: currentChurch.sms?.displayName || currentChurch.name || "",
        theme: (currentChurch.settings?.theme as any) || "dark"
      });
    }
  }, [currentChurch]);

  const handleSave = () => {
    if (!currentChurch) return;
    setIsSaving(true);

    const docRef = doc(db, "churches", currentChurch.id);
    const updateData = {
      name: settings.name,
      phone: settings.phone,
      settings: {
        birthdaySmsEnabled: settings.birthdaySmsEnabled,
        timezone: settings.timezone,
        lowCreditAlertEnabled: settings.lowCreditAlertEnabled,
        dailyReportsEnabled: settings.dailyReportsEnabled,
        theme: settings.theme
      },
      sms: {
        ...currentChurch.sms,
        displayName: settings.displayName || settings.name
      },
      smsTemplates: {
        birthday: settings.birthdayTemplate
      }
    };

    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: "Configuration Updated", description: "All ministry settings have been securely applied." });
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
    setIsChangingPassword(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, passwords.new);
        if (currentChurch?.id) {
          await updateDoc(doc(db, "churches", currentChurch.id), { mustChangePassword: false });
        }
        toast({ title: "Security Updated", description: "Your dashboard access password has been changed." });
        setPasswords({ new: "", confirm: "" });
      }
    } catch (error: any) {
      toast({ title: "Security Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (churchLoading) {
    return <div className="min-h-[400px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1 text-foreground">Ministry Configuration</h2>
          <p className="text-muted-foreground">Manage organizational behavior, automation, and security for {currentChurch?.name}.</p>
        </div>
        {!isForced && (
          <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 h-11 px-8 rounded-xl shadow-lg shadow-primary/20">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Apply Changes
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl w-full md:w-auto">
          <TabsTrigger value="general" className="rounded-xl px-6" disabled={isForced}>General</TabsTrigger>
          <TabsTrigger value="automation" className="rounded-xl px-6" disabled={isForced}>Automation</TabsTrigger>
          <TabsTrigger value="display" className="rounded-xl px-6" disabled={isForced}>Display</TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl px-6">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="animate-in fade-in-50 duration-500 space-y-6">
          <Card className="glass border-border shadow-xl">
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Core identity markers for your ministry.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Church Name</Label>
                  <Input value={settings.name} onChange={(e) => setSettings({...settings, name: e.target.value})} className="bg-muted/20 border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Local Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(v) => setSettings({...settings, timezone: v})}>
                    <SelectTrigger className="bg-muted/20 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass">
                      {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground italic flex items-center gap-1"><Globe className="w-3 h-3" /> Determines when automated messages are sent.</p>
                </div>
                <div className="space-y-2">
                  <Label>Official Contact Phone</Label>
                  <Input value={settings.phone} onChange={(e) => setSettings({...settings, phone: e.target.value})} className="bg-muted/20 border-border" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border shadow-xl">
            <CardHeader>
              <CardTitle>SaaS Custom Branding</CardTitle>
              <CardDescription>Configure how your ministry appears in SMS communications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Communication Display Name</Label>
                <Input 
                  value={settings.displayName} 
                  onChange={(e) => setSettings({...settings, displayName: e.target.value})} 
                  placeholder="e.g. Grace Community"
                  className="bg-muted/20 border-border" 
                />
                <p className="text-[10px] text-muted-foreground italic">
                  This name is used as the signature ({"{{churchName}}"}) in your message templates.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-muted/20 border flex justify-between items-center opacity-70">
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">Technical Sender ID</Label>
                  <p className="font-mono font-bold">{settings.senderId}</p>
                </div>
                <Badge variant="outline">Verified SaaS ID</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="animate-in fade-in-50 duration-500 space-y-6">
          <Card className="glass border-border shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cake className="w-5 h-5 text-accent" />
                Birthday Automation Engine
              </CardTitle>
              <CardDescription>Configure how the system handles member anniversaries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex items-center justify-between p-6 rounded-2xl bg-muted/20 border border-border">
                <div className="space-y-1">
                  <Label className="text-base">Enable Automatic Greetings</Label>
                  <p className="text-sm text-muted-foreground">The system will automatically send personalized SMS to celebrants at 06:00 AM daily.</p>
                </div>
                <Switch checked={settings.birthdaySmsEnabled} onCheckedChange={(c) => setSettings({...settings, birthdaySmsEnabled: c})} />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                   <Label className="text-base">Personalized Greeting Template</Label>
                   <span className="text-[10px] text-accent font-bold uppercase">Personalization Active</span>
                </div>
                <Textarea 
                  value={settings.birthdayTemplate} 
                  onChange={(e) => setSettings({...settings, birthdayTemplate: e.target.value})}
                  className="min-h-[120px] bg-muted/20 border-border font-body"
                  placeholder="Type your template here..."
                />
                <div className="flex flex-wrap gap-2">
                  <div className="px-2 py-1 bg-white border border-border rounded-lg text-[10px] font-mono text-primary font-bold">{"{{name}}"}</div>
                  <div className="px-2 py-1 bg-white border border-border rounded-lg text-[10px] font-mono text-primary font-bold">{"{{churchName}}"}</div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  Tip: Use the tags above to automatically insert the member's name and your church's display name into the message.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <MessageSquare className="w-5 h-5" />
                SMS Credit Enforcement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-center justify-between p-4 border-b border-border last:border-0">
                  <div>
                    <Label className="font-bold">Low Credit Notifications</Label>
                    <p className="text-xs text-muted-foreground">Alert administrators when balance falls below 50 credits.</p>
                  </div>
                  <Switch checked={settings.lowCreditAlertEnabled} onCheckedChange={(c) => setSettings({...settings, lowCreditAlertEnabled: c})} />
               </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="display" className="animate-in fade-in-50 duration-500 space-y-6">
          <Card className="glass border-border shadow-xl">
             <CardHeader><CardTitle>Platform Theme</CardTitle></CardHeader>
             <CardContent>
               <RadioGroup value={settings.theme} onValueChange={(v: any) => setSettings({...settings, theme: v})} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Label htmlFor="t-light" className={cn("flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-muted cursor-pointer hover:bg-muted/20 transition-all", settings.theme === 'light' && "border-primary bg-primary/5")}>
                    <RadioGroupItem value="light" id="t-light" className="sr-only" />
                    <Sun className="h-8 w-8 text-amber-500" />
                    <span className="font-bold">Light Mode</span>
                  </Label>
                  <Label htmlFor="t-dark" className={cn("flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-muted cursor-pointer hover:bg-muted/20 transition-all", settings.theme === 'dark' && "border-primary bg-primary/5")}>
                    <RadioGroupItem value="dark" id="t-dark" className="sr-only" />
                    <Moon className="h-8 w-8 text-primary" />
                    <span className="font-bold">Dark Mode</span>
                  </Label>
                  <Label htmlFor="t-system" className={cn("flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-muted cursor-pointer hover:bg-muted/20 transition-all", settings.theme === 'system' && "border-primary bg-primary/5")}>
                    <RadioGroupItem value="system" id="t-system" className="sr-only" />
                    <Laptop className="h-8 w-8 text-muted-foreground" />
                    <span className="font-bold">System Default</span>
                  </Label>
               </RadioGroup>
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="animate-in fade-in-50 duration-500 space-y-6">
           <Card className="glass border-border shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive"><Lock className="w-5 h-5" />Access Credentials</CardTitle>
                <CardDescription>Update your ministry dashboard entry keys.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
                  <div className="space-y-2">
                    <Label>New Security Key</Label>
                    <Input type="password" value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} className="bg-muted/20 border-border" placeholder="Min. 8 characters" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Security Key</Label>
                    <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} className="bg-muted/20 border-border" required />
                  </div>
                  <Button type="submit" disabled={isChangingPassword} className="w-full bg-primary h-12 rounded-xl text-lg font-bold">
                    {isChangingPassword ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="mr-2 h-5 w-5" />}
                    Update Security Keys
                  </Button>
                </form>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
