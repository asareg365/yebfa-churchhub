"use client";

import Link from "next/link";
import { ArrowLeft, Mail, Smartphone, ShieldCheck, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useUser } from "@/firebase";

export default function SupportPage() {
  const { user } = useUser();
  const backHref = user ? "/dashboard" : "/";
  const backLabel = user ? "Back to Dashboard" : "Back to Home";

  return (
    <div className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href={backHref}>
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" /> {backLabel}
          </Button>
        </Link>

        <div className="text-center mb-12 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Ministry Support Center</h1>
          <p className="text-muted-foreground text-lg">How can we help your organization thrive today?</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="glass border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Billing & SMS Credits
              </CardTitle>
              <CardDescription>Activation and recharge assistance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium mb-1">Direct MoMo Line</p>
                <p className="text-2xl font-bold text-primary">0248472474</p>
                <p className="text-xs text-muted-foreground mt-2">Reference: [Your Church Name]</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Contact this number for immediate manual activation of Standard and Premium plans or credit top-ups.
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-accent/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-accent" />
                Technical Support
              </CardTitle>
              <CardDescription>System access and configuration help.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-bold">Email Support</p>
                <p className="text-sm text-muted-foreground">asareg365@gmail.com</p>
                <p className="text-sm text-muted-foreground">frankyeb@gmail.com</p>
              </div>
              <div className="pt-4 flex items-center gap-2 text-xs text-accent font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                System Status: Operational
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 p-8 rounded-3xl glass border-border text-center space-y-6">
          <h3 className="text-xl font-bold">Frequently Asked Questions</h3>
          <div className="grid gap-4 text-left max-w-2xl mx-auto">
            <div className="space-y-1">
              <p className="font-semibold">How long does SMS activation take?</p>
              <p className="text-sm text-muted-foreground">Typically within 1 hour of payment receipt on the MoMo line.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Can I use my own mNotify account?</p>
              <p className="text-sm text-muted-foreground">Yes, Premium members can configure their own custom Sender IDs and API keys in settings.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Is my congregation's data safe?</p>
              <p className="text-sm text-muted-foreground">Absolutely. We use enterprise-grade multi-tenant isolation in Firestore to keep your data private.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
