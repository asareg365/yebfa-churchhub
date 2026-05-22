'use client';

import { useMemo } from 'react';
import { 
  Check, 
  Zap, 
  Shield, 
  Rocket,
  ArrowRight,
  Smartphone,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    id: 'Basic',
    name: 'Starter / Basic',
    price: '200',
    description: 'Perfect for small congregations.',
    features: [
      '100 SMS Credits per month',
      'Up to 200 Church Members',
      '1 Church Administrator',
      'Member Directory',
      'Attendance Tracking',
      'Basic Email Support'
    ],
    icon: Rocket,
    color: 'hsl(var(--primary))'
  },
  {
    id: 'Standard',
    name: 'Ministry Growth',
    price: '500',
    description: 'Advanced tools for active churches.',
    features: [
      '1,000 SMS Credits per month',
      'Up to 1,000 Church Members',
      'Financial Management Suite',
      'AI Communication Assistant',
      'Priority WhatsApp Support'
    ],
    icon: Shield,
    color: 'hsl(var(--accent))',
    featured: true
  },
  {
    id: 'Premium',
    name: 'Enterprise / Premium',
    price: '1,200',
    description: 'Full suite for large organizations.',
    features: [
      '5,000 SMS Credits per month',
      'Unlimited Church Members',
      'AI Pastoral Insight Tool',
      'Multi-Branch Support',
      'Custom Data Reports',
      'Dedicated Account Manager'
    ],
    icon: Zap,
    color: 'hsl(var(--primary))'
  }
];

export default function PlansPage() {
  const db = useFirestore();
  const { user } = useUser();

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const currentPlanId = currentChurch?.plan || 'Basic';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <h2 className="text-4xl font-bold tracking-tight">Flexible Ministry Plans</h2>
        <p className="text-muted-foreground">Select the tier that best fits your congregation's current growth stage and SMS needs.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card 
            key={plan.id} 
            className={cn(
              "glass flex flex-col transition-all duration-500 hover:shadow-2xl relative",
              plan.featured && "border-accent/40 ring-1 ring-accent/20 scale-105 z-10",
              plan.id === currentPlanId && "border-primary/50"
            )}
          >
            {plan.featured && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <Badge className="bg-accent text-white uppercase text-[10px] font-bold px-4 py-1 rounded-full shadow-lg">Most Popular</Badge>
              </div>
            )}
            
            <CardHeader className="text-center pb-8 pt-10">
              <div className="w-16 h-16 rounded-3xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
                <plan.icon className="w-8 h-8" style={{ color: plan.color }} />
              </div>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription className="text-xs">{plan.description}</CardDescription>
              <div className="pt-6">
                <span className="text-4xl font-bold">GH₵{plan.price}</span>
                <span className="text-muted-foreground text-sm"> / month</span>
              </div>
            </CardHeader>

            <CardContent className="flex-1 space-y-4">
              <div className="space-y-3">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-accent" />
                    </div>
                    <span className={cn("text-muted-foreground", feature.includes("SMS") && "font-bold text-primary")}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter className="pt-8">
              <Button 
                className={cn(
                  "w-full h-12 rounded-2xl font-bold text-sm",
                  plan.id === currentPlanId ? "bg-muted text-muted-foreground border-0" : 
                  plan.featured ? "bg-accent hover:bg-accent/90 text-white" : "bg-primary text-white"
                )}
                disabled={plan.id === currentPlanId}
                onClick={() => window.open('https://wa.me/233248472474')}
              >
                {plan.id === currentPlanId ? 'Current Active Plan' : `Upgrade to ${plan.id}`}
                {plan.id !== currentPlanId && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="max-w-4xl mx-auto p-8 rounded-3xl glass border-primary/10 flex flex-col md:flex-row items-center gap-8 shadow-xl">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <MessageSquare className="h-8 w-8" />
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="text-xl font-bold">SMS Credits & Activation</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Credits are reset on the 1st of every month. Basic plans receive 100, Growth plans receive 1,000, and Premium plans receive 5,000 credits. Need more? Contact support for custom top-ups.
          </p>
        </div>
        <Button variant="outline" className="h-12 px-8 rounded-xl font-bold text-xs" onClick={() => window.open('https://wa.me/233248472474')}>
          Contact Support
        </Button>
      </div>
    </div>
  );
}
