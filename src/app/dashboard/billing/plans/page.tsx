'use client';

import { useMemo } from 'react';
import { 
  Check, 
  Zap, 
  Shield, 
  Rocket,
  ArrowRight,
  Smartphone,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export default function PlansPage() {
  const db = useFirestore();
  const { user } = useUser();

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const currentPlan = currentChurch?.plan || 'Starter';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4 max-w-2xl mx-auto py-10">
        <h2 className="text-4xl font-bold tracking-tight">Simple Transparent Pricing</h2>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Contact us to choose the plan that fits your ministry's current stage. We're here to help you scale your digital outreach.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="glass border-primary/20 shadow-2xl overflow-hidden">
          <div className="bg-primary/5 p-8 border-b border-border flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-3xl bg-white flex items-center justify-center border border-border shadow-sm">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Subscription</p>
                <h3 className="text-2xl font-bold text-foreground">Current Plan: {currentPlan}</h3>
              </div>
            </div>
            <Badge className="bg-accent text-white px-4 py-1 text-xs font-bold uppercase rounded-full">Active Service</Badge>
          </div>
          
          <CardContent className="p-12 text-center space-y-8">
            <div className="space-y-4">
              <div className="h-20 w-20 rounded-[2rem] bg-accent/10 flex items-center justify-center text-accent mx-auto shadow-inner">
                <MessageSquare className="h-10 w-10" />
              </div>
              <h3 className="text-3xl font-bold text-foreground">Ready to Upgrade?</h3>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Our support team is standing by to help you scale your SMS limits and unlock enterprise features like AI Pastoral Insights.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <Button 
                size="lg" 
                className="h-14 px-10 text-lg bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95" 
                onClick={() => window.open('https://wa.me/233248472474')}
              >
                Contact via WhatsApp
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-14 px-10 text-lg rounded-2xl border-2 hover:bg-muted/50 transition-all"
                onClick={() => window.open('tel:0248472474')}
              >
                <Smartphone className="mr-2 h-5 w-5" /> Call for Activation
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground font-medium pt-4">
              Immediate Activation Support: <span className="text-primary font-bold">0248472474</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-4xl mx-auto p-8 rounded-3xl glass border-primary/10 flex flex-col md:flex-row items-center gap-8 shadow-xl">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Shield className="h-8 w-8" />
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="text-xl font-bold">SMS Credits & Activation</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Credits are typically reset on the 1st of every month. Standard allocations range from 100 to 10,000 credits based on your selected tier. Need a custom top-up? Contact our team for instant recharge verification.
          </p>
        </div>
      </div>
    </div>
  );
}
