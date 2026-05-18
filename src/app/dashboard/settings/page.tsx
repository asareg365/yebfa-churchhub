
"use client";

import { Settings, User, Bell, Shield, Cloud, CreditCard, Save, Check, Info, Smartphone, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const plans = [
    {
      name: "Starter",
      price: "200",
      description: "Essential tools for small congregations.",
      features: ["Up to 200 members", "Attendance tracking", "Basic reports", "Email support"],
      current: false
    },
    {
      name: "Growth",
      price: "500",
      description: "Advanced features for growing ministries.",
      features: ["Up to 1,000 members", "Finance management", "AI Insights Lite", "Priority support"],
      current: true
    },
    {
      name: "Premium",
      price: "1,200",
      description: "Full suite for enterprise organizations.",
      features: ["Unlimited members", "Full AI Suite", "Bulk SMS engine", "Dedicated manager"],
      current: false
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Settings</h2>
          <p className="text-muted-foreground">Manage your church configuration and platform preferences.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/80">
          <Save className="mr-2 h-4 w-4" /> Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="general" className="rounded-xl px-6">General</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-xl px-6">Notifications</TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl px-6">Security</TabsTrigger>
          <TabsTrigger value="billing" className="rounded-xl px-6">Billing</TabsTrigger>
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
                  <Input placeholder="Enter church name" defaultValue="Grace Community Sanctuary" className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>Organization Email</Label>
                  <Input placeholder="email@church.org" defaultValue="admin@gracecommunity.org" className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input placeholder="+233..." defaultValue="+233 24 847 2474" className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input defaultValue="GMT+0 (Accra)" className="bg-white/5 border-white/10" />
                </div>
              </div>
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
                  <p className="text-sm text-muted-foreground">Send greetings to members on their birthday.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-base">Low SMS Credit Alert</Label>
                  <p className="text-sm text-muted-foreground">Notify when credits fall below 500.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-base">Daily Attendance Reports</Label>
                  <p className="text-sm text-muted-foreground">Email summary of attendance each evening.</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6 animate-in fade-in-50 duration-500">
          <Alert className="glass-primary border-primary/30 py-6 rounded-3xl">
            <Smartphone className="h-6 w-6 text-primary" />
            <AlertTitle className="text-primary font-bold text-lg ml-2">Payment Instructions</AlertTitle>
            <AlertDescription className="mt-2 text-foreground/90 ml-2 text-base">
              To activate or renew your plan, please MoMo the plan cost to 
              <span className="font-bold text-primary mx-1">0248472474</span>. 
              Use your <span className="font-bold underline">Church Name</span> as the reference. 
              Once paid, our team will approve your access within 1 hour.
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

        <TabsContent value="security" className="animate-in fade-in-50 duration-500">
          <Card className="glass border-destructive/20 overflow-hidden">
            <CardHeader className="bg-destructive/5 border-b border-white/5">
              <CardTitle className="text-destructive flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>Critical actions for your church account that cannot be undone.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
                <div>
                  <h4 className="font-bold text-destructive">Delete Church Data</h4>
                  <p className="text-sm text-muted-foreground">Permanently remove all members, records, and financial history.</p>
                </div>
                <Button variant="destructive" className="bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white rounded-xl">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Everything
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
