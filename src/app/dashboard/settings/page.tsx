
"use client";

import { Settings, User, Bell, Shield, Cloud, CreditCard, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
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
        <TabsList className="glass border-white/10 p-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
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
                  <Input placeholder="+1..." defaultValue="+1 (555) 000-1122" className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input defaultValue="UTC-5 (EST)" className="bg-white/5 border-white/10" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Control how you and your members receive updates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automated Birthday SMS</Label>
                  <p className="text-xs text-muted-foreground">Send greetings to members on their birthday.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Low SMS Credit Alert</Label>
                  <p className="text-xs text-muted-foreground">Notify when credits fall below 500.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Attendance Reports</Label>
                  <p className="text-xs text-muted-foreground">Email summary of attendance each evening.</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="glass border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Critical actions for your church account.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" className="bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white">
                Delete Church Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
