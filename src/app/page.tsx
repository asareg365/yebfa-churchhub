
"use client";

import Link from "next/link";
import { Sparkles, Shield, Users, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="fixed top-0 w-full z-50 glass border-b border-white/5 py-4 px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
              <span className="text-primary font-bold">Y</span>
            </div>
            <span className="font-headline text-sm font-bold tracking-tighter text-white">CHURCHHUB</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Pricing</a>
            <Link href="/dashboard">
              <Button variant="ghost" className="text-sm">Login</Button>
            </Link>
            <Link href="/dashboard">
              <Button className="bg-primary text-primary-foreground">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 pt-32">
        <section className="px-8 max-w-7xl mx-auto text-center space-y-8 py-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-primary/20 text-xs font-bold text-primary uppercase tracking-widest animate-bounce">
            <Sparkles className="w-3 h-3" />
            Next-Gen Church Management
          </div>
          <h1 className="text-5xl md:text-7xl font-headline font-bold text-white tracking-tighter leading-tight max-w-4xl mx-auto">
            EMPOWER YOUR <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">MINISTRY</span> WITH INTELLIGENCE
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Enterprise-grade multi-tenant platform featuring AI-powered pastoral insights, automated communication, and secure data isolation.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Link href="/dashboard">
              <Button size="lg" className="h-14 px-10 text-lg bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-xl shadow-primary/20">
                Enter Dashboard <ArrowRight className="ml-2" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 px-10 text-lg glass border-white/10 hover:bg-white/5 rounded-2xl">
              Watch Demo
            </Button>
          </div>
        </section>

        <section id="features" className="px-8 max-w-7xl mx-auto py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass p-8 rounded-3xl space-y-4 hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-headline">Secure Isolation</h3>
              <p className="text-muted-foreground">Each church operates in a fully isolated tenant environment with zero data leakage.</p>
            </div>
            <div className="glass p-8 rounded-3xl space-y-4 hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-headline">AI Insights</h3>
              <p className="text-muted-foreground">Advanced reasoning tools to analyze congregation trends and spiritual growth.</p>
            </div>
            <div className="glass p-8 rounded-3xl space-y-4 hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-headline">Community First</h3>
              <p className="text-muted-foreground">Automated birthday SMS, QR check-ins, and sophisticated member management.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 px-8 border-t border-white/5 glass mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">Y</span>
            </div>
            <span className="font-headline text-xs font-bold text-white">YEBFA CHURCHHUB</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © Yebfa Consult 2026. Built for the modern church.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">Twitter</a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
