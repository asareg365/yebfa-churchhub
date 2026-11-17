
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
  Globe,
  Users,
  UserPlus,
  Trash2,
  ShieldCheck,
  Mail,
  Church as ChurchIcon,
  UserCheck,
  FileBadge,
  Layout,
  Plus,
  Building2
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
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useAuth } from "@/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { cn } from "@/lib/utils";
import { useTenant } from "@/context/tenant-context";

const TIMEZONES = [
  "Africa/Accra",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Europe/London",
  "America/New_York",
  "UTC"
];

const DENOMINATIONS = [
  "Pentecostal",
  "Catholic",
  "Methodist",
  "Presbyterian",
  "Baptist",
  "Charismatic",
  "Other"
];

const SUPER_ADMINS = ["asareg365@gmail.com", "frankyeb@gmail.com"];
const DEFAULT_DEPARTMENTS = ["Music", "Youth", "Media", "Children", "Welfare", "Ushering", "Evangelism"];

export default function SettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const { currentChurch, loading: churchLoading, isSuperAdmin } = useTenant();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const isForced = searchParams.get("force") === "true";

  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState(isForced ? "security" : "general");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newDepartment, setNewDepartment] = useState("");

  const [settings, setSettings] = useState({
    name: "",
    phone: "",
    denomination: "Pentecostal",
    birthdaySmsEnabled: true,
    timezone: "Africa/Accra",
    birthdayTemplate: "Happy Birthday {{name}}! May God bless your new age with favor and joy. — {{churchName}}",
    lowCreditAlertEnabled: true,
    dailyReportsEnabled: false,
    senderId: "YEBFA",
    displayName: "",
    departments: DEFAULT_DEPARTMENTS,
    theme: "dark" as "light" | "dark" | "system", 
    extendedProfile: {
      enabled: false,
      showInRegistration: true,
      fields: {
        placeOfBirth: true,
        maritalStatus: true,
        educationLevel: true,
        baptism: true,
        confirmation: true
      }
    }
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
        denomination: currentChurch.denomination || "Pentecostal",
        birthdaySmsEnabled: currentChurch.settings?.birthdaySmsEnabled ?? true,
        timezone: currentChurch.settings?.timezone || "Africa/Accra",
        birthdayTemplate: currentChurch.smsTemplates?.birthday || "Happy Birthday {{name}}! May God bless your new age with favor and joy. — {{churchName}}",
        lowCreditAlertEnabled: currentChurch.settings?.lowCreditAlertEnabled ?? true,
        dailyReportsEnabled: currentChurch.settings?.dailyReportsEnabled ?? false,
        senderId: currentChurch.sms?.senderId || "YEBFA",
        displayName: currentChurch.sms?.displayName || currentChurch.name || "",
        departments: Array.from(new Set([...DEFAULT_DEPARTMENTS, ...(currentChurch.settings?.departments || [])])),
        theme: (currentChurch.settings?.theme as any) || "dark",
        extendedProfile: {
          enabled: currentChurch.settings?.extendedProfile?.enabled ?? false,
          showInRegistration: currentChurch.settings?.extendedProfile?.showInRegistration ?? true,
          fields: currentChurch.settings?.extendedProfile?.fields || {
            placeOfBirth: true,
            maritalStatus: true,
            educationLevel: true,
            baptism: true,
            confirmation: true
          }
        }
      });
    }
  }, [currentChurch]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (settings.theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  const handleSave = () => {
    if (!currentChurch || !db) return;
    setIsSaving(true);

    const docRef = doc(db, "churches", currentChurch.id);
    const updateData = {
      name: settings.name,
      phone: settings.phone,
      denomination: settings.denomination,
      settings: {
        ...currentChurch.settings,
        birthdaySmsEnabled: settings.birthdaySmsEnabled,
        timezone: settings.timezone,
        lowCreditAlertEnabled: settings.lowCreditAlertEnabled,
        dailyReportsEnabled: settings.dailyReportsEnabled,
        theme: settings.theme,
        departments: settings.departments,
        extendedProfile: settings.extendedProfile
      },
      sms: {
        ...currentChurch.sms,
        displayName: settings.displayName || settings.name
      },
      smsTemplates: {
        ...currentChurch.smsTemplates,
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

  const canManageDepartments = !!isSuperAdmin || (currentChurch?.adminEmail || "").toLowerCase() === (user?.email || "").toLowerCase();

  const handleAddDepartment = () => {
    const name = newDepartment.trim().replace(/\\s+/g, " ");
    if (!canManageDepartments) {
      toast({ title: "Permission denied", description: "Only the Super Admin or church owner can add departments.", variant: "destructive" });
      return;
    }
    if (!name) return;
    if (settings.departments.some((item: string) => item.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Department already exists", variant: "destructive" });
      return;
    }
    setSettings((current) => ({ ...current, departments: [...current.departments, name] }));
    setNewDepartment("");
    toast({ title: "Department added", description: "Select Apply Changes to save it for this church." });
  };

  const handleAddAdminEmail = async () => {
    if (!newAdminEmail || !currentChurch || !db) return;
    const email = newAdminEmail.toLowerCase().trim();
    
    if (currentChurch.adminEmails?.includes(email)) {
      toast({ title: "User already authorized", variant: "destructive" });
      return;
    }

    try {
      const docRef = doc(db, "churches", currentChurch.id);
      await updateDoc(docRef, {
        adminEmails: arrayUnion(email)
      });
      setNewAdminEmail("");
      toast({ title: "User Authorized", description: `${email} can now access this ministry.` });
    } catch (e) {
      toast({ title: "Authorization Failed", variant: "destructive" });
    }
  };

  const handleRemoveAdminEmail = async (email: string) => {
    if (!currentChurch || !db) return;
    
    if (SUPER_ADMINS.includes(email)) {
      toast({ title: "Action Forbidden", description: "Cannot remove system-wide administrators.", variant: "destructive" });
      return;
    }

    if (email === user?.email?.toLowerCase().trim()) {
      toast({ title: "Action Forbidden", description: "You cannot remove your own access from this portal.", variant: "destructive" });
      return;
    }

    try {
      const docRef = doc(db, "churches", currentChurch.id);
      await updateDoc(docRef, {
        adminEmails: arrayRemove(email)
      });
      toast({ title: "Access Revoked", description: `${email} has been removed from the team.` });
    } catch (e) {
      toast({ title: "Revocation Failed", variant: "destructive" });
    }
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
          <TabsTrigger value="team" className="rounded-xl px-6" disabled={isForced}>Team</TabsTrigger>
          <TabsTrigger value="departments" className="rounded-xl px-6" disabled={isForced}>Departments</TabsTrigger>
          <TabsTrigger value="extended-profile" className="rounded-xl px-6" disabled={isForced}>Extended Profile</TabsTrigger>
          <TabsTrigger value="automation" className="rounded-xl px-6" disabled={isForced}>Automation</TabsTrigger>
          <TabsTrigger value="display" className="rounded-xl px-6" disabled={isForced}>Display</TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl px-6">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="animate-in fade-in-50 duration-500 space-y-6">
          <Card className="glass border-border shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" /> Department Management</CardTitle>
              <CardDescription>Manage the departments available to members of {currentChurch?.name || "this church"}. Each church has its own department list.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {canManageDepartments ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="new-department">New department name</Label>
                      <Input id="new-department" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} placeholder="e.g. Prayer Ministry" maxLength={60} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddDepartment(); } }} />
                    </div>
                    <Button type="button" className="sm:mt-8" onClick={handleAddDepartment} disabled={!newDepartment.trim()}><Plus className="w-4 h-4 mr-2" /> Add Department</Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Available departments ({settings.departments.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {settings.departments.map((department: string) => (
                        <Badge key={department} variant="secondary" className="px-3 py-1">{department}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Built-in departments are retained. New departments are added to this church only and become available in member records, public registration and CSV imports after you select Apply Changes. Existing member department values are preserved.</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Only the Super Admin or the owner of this church can manage departments.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
                  <Label>Primary Denomination</Label>
                  <Select value={settings.denomination} onValueChange={(v) => setSettings({...settings, denomination: v})}>
                    <SelectTrigger className="bg-muted/20 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass">
                      {DENOMINATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground italic flex items-center gap-1"><ChurchIcon className="w-3 h-3" /> Unlocks specialized fields for specific denominations.</p>
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

        <TabsContent value="extended-profile" className="animate-in fade-in-50 duration-500 space-y-6">
          <Card className="glass border-border shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileBadge className="w-5 h-5 text-primary" />
                Extended Member Profile
              </CardTitle>
              <CardDescription>Configure additional data points collected for your congregation members.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-6 rounded-2xl bg-muted/20 border border-primary/10">
                <div className="space-y-1">
                  <Label className="text-base font-bold">Enable Extended Profiles</Label>
                  <p className="text-sm text-muted-foreground">Activates advanced personal, baptism, and confirmation fields.</p>
                </div>
                <div className="flex items-center gap-4">
                  {!isSuperAdmin && (
                    <Badge variant="outline" className="text-[10px] bg-white">Paid Subscription Required</Badge>
                  )}
                  <Switch 
                    disabled={!isSuperAdmin} 
                    checked={settings.extendedProfile.enabled} 
                    onCheckedChange={(v) => setSettings({
                      ...settings, 
                      extendedProfile: { ...settings.extendedProfile, enabled: v }
                    })} 
                  />
                </div>
              </div>

              {settings.extendedProfile.enabled && (
                <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-xl bg-white/50 border border-border flex items-center justify-between">
                       <div className="space-y-0.5">
                          <Label className="text-sm">Show in Public Registration</Label>
                          <p className="text-[10px] text-muted-foreground">Captured when members join via your public link.</p>
                       </div>
                       <Switch 
                         checked={settings.extendedProfile.showInRegistration}
                         onCheckedChange={(v) => setSettings({
                           ...settings,
                           extendedProfile: { ...settings.extendedProfile, showInRegistration: v }
                         })}
                       />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Field Configuration</Label>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {Object.entries(settings.extendedProfile.fields).map(([key, active]) => (
                        <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border group hover:border-primary/20 transition-all">
                          <span className="text-xs font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <Switch 
                            className="scale-75"
                            checked={active as boolean} 
                            onCheckedChange={(v) => setSettings({
                              ...settings,
                              extendedProfile: {
                                ...settings.extendedProfile,
                                fields: { ...settings.extendedProfile.fields, [key]: v }
                              }
                            })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!settings.extendedProfile.enabled && !isSuperAdmin && (
                <Alert className="bg-primary/5 border-primary/10">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-xs font-bold uppercase">System Administration Required</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed">
                    This is a premium organizational feature. Please contact platform support at <strong>0248472474</strong> to enable Extended Member Profile Management for your ministry.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="animate-in fade-in-50 duration-500 space-y-6">
          <Card className="glass border-border shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Team Management
              </CardTitle>
              <CardDescription>Authorize additional users to access this ministry dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="new-admin-email">Add Team Member Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="new-admin-email"
                      type="email"
                      placeholder="pastor@church.org" 
                      className="pl-10 bg-muted/20"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="mt-8 bg-accent text-white h-10 px-6 rounded-xl" onClick={handleAddAdminEmail}>
                  <UserPlus className="w-4 h-4 mr-2" /> Authorize
                </Button>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Authorized Personnel</Label>
                <div className="grid gap-2">
                  {currentChurch?.adminEmails?.map((email: string) => (
                    <div key={email} className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border group hover:border-primary/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{email}</p>
                          {SUPER_ADMINS.includes(email) ? (
                            <Badge variant="secondary" className="text-[8px] h-4">System Super Admin</Badge>
                          ) : email === currentChurch.adminEmail ? (
                            <Badge variant="outline" className="text-[8px] h-4 text-accent border-accent/20">Owner</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] h-4">Dashboard Admin</Badge>
                          )}
                        </div>
                      </div>
                      {!SUPER_ADMINS.includes(email) && email !== user?.email?.toLowerCase().trim() && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveAdminEmail(email)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
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
