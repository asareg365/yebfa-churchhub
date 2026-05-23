"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Shield, Users, Zap, ArrowRight, Check, Smartphone, Search, ShieldCheck, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CrossIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="w-6 h-6 text-primary"
  >
    <path d="M12 4v16M8 9h8" />
  </svg>
);

export default function LandingPage() {
  const [tenantSlug, setTenantSlug] = useState("");
  const router = useRouter();

  const handleFindMinistry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantSlug) return;
    router.push(`/login?tenant=${tenantSlug.toLowerCase().trim()}`);
  };

  const plans = [
    {
      name: "Starter",
      price: "200",
      description: "Essential tools for small congregations.",
      features: [
        "Up to 200 members", 
        "100 Monthly SMS Credits",
        "Attendance tracking", 
        "Basic reports", 
        "Email support"
      ],
      accent: false
    },
    {
      name: "Growth",
      price: "500",
      description: "Advanced features for growing ministries.",
      features: [
        "Up to 1,000 members", 
        "1,000 Monthly SMS Credits",
        "Finance management", 
        "AI Insights Lite", 
        "Priority support"
      ],
      accent: true
    },
    {
      name: "Premium",
      price: "1,200",
      description: "Full suite for enterprise organizations.",
      features: [
        "Unlimited members", 
        "5,000 Monthly SMS Credits",
        "Full AI Suite", 
        "Bulk SMS engine", 
        "Dedicated manager"
      ],
      accent: false
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="fixed top-0 w-full z-50 glass border-b border-border py-4 px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-border shadow-sm">
              <CrossIcon />
            </div>
            <span className="font-headline text-sm font-bold tracking-tighter text-foreground">CHURCHHUB</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Pricing</a>
            <Link href="/admin/login">
              <Button variant="ghost" className="text-sm flex items-center gap-2 text-primary">
                <ShieldCheck className="w-4 h-4" /> Admin Access
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="text-sm text-foreground">Login</Button>
            </Link>
            <Link href="/login?tab=signup">
              <Button className="bg-primary text-primary-foreground">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 pt-32">
        <section className="px-8 max-w-7xl mx-auto text-center space-y-8 py-20 animate-in fade-in duration-1000 slide-in-from-top-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-widest animate-float">
            <Sparkles className="w-3 h-3" />
            Next-Gen Church Management
          </div>
          <h1 className="text-5xl md:text-7xl font-headline font-bold text-foreground tracking-tighter leading-tight max-w-4xl mx-auto">
            EMPOWER YOUR <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">MINISTRY</span> WITH INTELLIGENCE
          </h1>
          
          <div className="max-w-md mx-auto pt-4">
            <form onSubmit={handleFindMinistry} className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <Input 
                placeholder="Enter your Ministry Slug (e.g. grace-sanctuary)" 
                className="h-14 pl-12 pr-32 bg-white/50 border-border rounded-2xl text-lg focus:ring-primary/50"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
              />
              <Button 
                type="submit"
                className="absolute right-2 top-2 h-10 px-4 bg-primary hover:bg-primary/80 rounded-xl"
              >
                Find Ministry
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">Don't have a slug? Enter the ID provided during registration.</p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Link href="/login?tab=signup">
              <Button size="lg" className="h-14 px-10 text-lg bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-xl shadow-primary/20">
                Register New Ministry <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </section>

        <section id="features" className="px-8 max-w-7xl mx-auto py-20">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-bold font-headline tracking-tighter text-foreground">Core Capabilities</h2>
            <p className="text-muted-foreground">Everything you need to manage a thriving modern congregation.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl space-y-4 border border-border hover:border-primary/30 transition-colors shadow-sm">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-headline text-foreground">Secure Isolation</h3>
              <p className="text-muted-foreground">Each church operates in a fully isolated tenant environment with zero data leakage.</p>
            </div>
            <div className="bg-white p-8 rounded-3xl space-y-4 border border-border hover:border-primary/30 transition-colors shadow-sm">
              <div className="h-12 w-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-headline text-foreground">AI Insights</h3>
              <p className="text-muted-foreground">Advanced reasoning tools to analyze congregation trends and spiritual growth.</p>
            </div>
            <div className="bg-white p-8 rounded-3xl space-y-4 border border-border hover:border-primary/30 transition-colors shadow-sm">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-headline text-foreground">SMS Quotas</h3>
              <p className="text-muted-foreground">Integrated SMS plan system for automated greetings, notifications, and pastoral care.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className="px-8 max-w-7xl mx-auto py-20">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-bold font-headline tracking-tighter text-foreground">Simple Transparent Pricing</h2>
            <p className="text-muted-foreground">Choose the plan that fits your ministry's current stage.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 mb-16">
            {plans.map((plan) => (
              <div 
                key={plan.name} 
                className={`bg-white p-8 rounded-3xl space-y-6 flex flex-col border border-border shadow-sm ${plan.accent ? 'border-primary/50 ring-1 ring-primary/20 scale-105' : ''}`}
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{plan.description}</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">GH₵{plan.price}</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </div>
                <ul className="space-y-4 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-foreground">
                      <div className="h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-accent" />
                      </div>
                      <span className={feature.includes("SMS Credits") ? "font-bold text-primary" : ""}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/login?tab=signup" className="block w-full">
                  <Button className={`w-full h-12 rounded-2xl font-bold ${plan.accent ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}>
                    Choose {plan.name}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          <div className="bg-white p-8 rounded-3xl max-w-4xl mx-auto border border-border shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                <Smartphone className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-foreground">How to Pay</h4>
                <p className="text-muted-foreground text-sm">
                  To activate your ministry account and receive your SMS allocation, please send the plan cost via MoMo to <span className="text-primary font-bold">0248472474</span>. 
                  Use your <span className="underline decoration-primary">Church Name</span> as the transaction reference. 
                  Approvals are typically processed within 1 hour.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 px-8 border-t border-border bg-white mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white border border-border shadow-sm flex items-center justify-center">
              <CrossIcon />
            </div>
            <span className="font-headline text-xs font-bold text-foreground">YEBFA CHURCHHUB</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © Yebfa Consult 2026. Built for the modern church.
          </p>
          <div className="flex gap-6 items-center">
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="/support" className="text-xs text-muted-foreground hover:text-primary transition-colors">Support</Link>
            <span className="text-border">|</span>
            <Link href="/admin/login" className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
              <ShieldCheck className="w-3 h-3" />
              Admin Access
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}