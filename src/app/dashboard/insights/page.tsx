
"use client";

import { useState, useMemo } from "react";
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  Loader2, 
  BrainCircuit, 
  History,
  Calendar,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { aiPastoralInsightTool, AIPastoralInsightOutput } from "@/ai/flows/ai-pastoral-insight-tool";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, where, limit, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function InsightsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<AIPastoralInsightOutput | null>(null);

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);

  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  // Resource collections for analysis input
  const attendanceRef = useMemo(() => currentChurch?.id ? collection(db, "churches", currentChurch.id, "attendance") : null, [db, currentChurch?.id]);
  const financesRef = useMemo(() => currentChurch?.id ? collection(db, "churches", currentChurch.id, "finances") : null, [db, currentChurch?.id]);
  
  // History collection for persistence
  const insightsRef = useMemo(() => currentChurch?.id ? collection(db, "churches", currentChurch.id, "aiInsights") : null, [db, currentChurch?.id]);

  const { data: attendance } = useCollection(attendanceRef ? query(attendanceRef, limit(100)) : null);
  const { data: finances } = useCollection(financesRef ? query(financesRef, limit(100)) : null);
  const { data: history, loading: historyLoading } = useCollection(insightsRef ? query(insightsRef, orderBy("createdAt", "desc")) : null);

  // Determine what to show in "Current" tab
  const currentInsight = useMemo(() => {
    if (selectedInsight) return selectedInsight;
    if (history && history.length > 0) return history[0] as any as AIPastoralInsightOutput;
    return null;
  }, [selectedInsight, history]);

  const runAnalysis = async () => {
    if (!currentChurch || !insightsRef) {
      toast({ title: "Ministry context required", description: "Could not find your ministry record.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await aiPastoralInsightTool({
        churchName: currentChurch.name || "Our Ministry",
        attendanceRecords: (attendance || []).map(a => ({ date: a.date, count: a.count })),
        financialRecords: (finances || []).map(f => ({ date: f.date, amount: f.amount, type: f.type })),
        currentChallenges: "General analysis requested for recent growth trends.",
        desiredOutcomes: "Improve community engagement and retention."
      });

      // Persist to history
      await addDoc(insightsRef, {
        ...result,
        createdAt: serverTimestamp(),
        generatedBy: user?.email
      });

      setSelectedInsight(result);
      toast({ title: "Analysis complete", description: "Fresh pastoral insights are archived and ready." });
    } catch (error) {
      toast({ title: "Analysis failed", description: "Ensure you have recorded attendance and finances first.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">AI Pastoral Insights</h2>
          <p className="text-muted-foreground">Deep data analysis to foster spiritual growth and community engagement.</p>
        </div>
        <Button 
          onClick={runAnalysis} 
          disabled={isAnalyzing || !currentChurch}
          className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-lg shadow-primary/20 px-8 h-12 rounded-2xl"
        >
          {isAnalyzing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <BrainCircuit className="mr-2 h-5 w-5" />}
          {history && history.length > 0 ? "Refresh Analysis" : "Run AI Analysis"}
        </Button>
      </div>

      <Tabs defaultValue="current" className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="current" className="rounded-xl px-6">
            <Sparkles className="w-4 h-4 mr-2" />
            Current Analysis
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl px-6">
            <History className="w-4 h-4 mr-2" />
            Insight History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="animate-in fade-in-50 duration-500">
          {!currentInsight ? (
            <div className="h-[400px] flex flex-col items-center justify-center glass rounded-3xl border-dashed border-primary/20">
              <Sparkles className="h-16 w-16 text-primary/20 mb-4 animate-pulse" />
              <h3 className="text-xl font-semibold text-muted-foreground">No analysis data yet</h3>
              <p className="text-sm text-muted-foreground mb-6">Click the button above to analyze your church's health.</p>
              <div className="flex gap-8 text-center opacity-50">
                <div className="space-y-1">
                   <TrendingUp className="mx-auto h-5 w-5 text-accent" />
                   <p className="text-[10px] font-bold uppercase">Growth</p>
                </div>
                <div className="space-y-1">
                   <Lightbulb className="mx-auto h-5 w-5 text-primary" />
                   <p className="text-[10px] font-bold uppercase">Engagement</p>
                </div>
                <div className="space-y-1">
                   <AlertTriangle className="mx-auto h-5 w-5 text-destructive" />
                   <p className="text-[10px] font-bold uppercase">Risk Mitigation</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 animate-in zoom-in-95 duration-500">
              <Card className="glass border-primary/30 shadow-2xl overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-3">
                      <Sparkles className="h-6 w-6 text-primary" />
                      Executive Summary
                    </CardTitle>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-2 py-1 rounded-md">
                      Generated: {selectedInsight ? 'Just Now' : (history?.[0]?.createdAt?.toDate ? format(history[0].createdAt.toDate(), 'MMM d, yyyy') : 'Recently')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-8">
                  <p className="text-xl leading-relaxed text-foreground/90 italic font-medium text-center max-w-4xl mx-auto">
                    "{currentInsight.summaryInsight}"
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-3">
                <Card className="glass group hover:border-accent/40 transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-accent">
                      <TrendingUp className="h-5 w-5" />
                      Growth Strategies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {currentInsight.growthStrategies.map((strategy, i) => (
                        <li key={i} className="flex gap-3 text-sm leading-relaxed group-hover:translate-x-1 transition-transform">
                          <div className="h-5 w-5 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                             <Check className="h-3 w-3" />
                          </div>
                          <span className="text-muted-foreground font-medium">{strategy}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="glass group hover:border-primary/40 transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <Lightbulb className="h-5 w-5" />
                      Engagement Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {currentInsight.engagementRecommendations.map((tip, i) => (
                        <li key={i} className="flex gap-3 text-sm leading-relaxed group-hover:translate-x-1 transition-transform">
                          <div className="h-5 w-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                             <Check className="h-3 w-3" />
                          </div>
                          <span className="text-muted-foreground font-medium">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="glass border-destructive/20 group hover:border-destructive/40 transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      Risk Factors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {currentInsight.potentialRisks.map((risk, i) => (
                        <li key={i} className="flex gap-3 text-sm leading-relaxed group-hover:translate-x-1 transition-transform">
                          <div className="h-5 w-5 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5">
                             <ChevronRight className="h-3 w-3" />
                          </div>
                          <span className="text-muted-foreground font-medium">{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="animate-in fade-in-50 duration-500">
          <Card className="glass min-h-[400px]">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle>Historical Analyses</CardTitle>
              <CardDescription>Review past strategies and track ministry evolution.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               {historyLoading ? (
                 <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
               ) : history && history.length > 0 ? (
                 <div className="divide-y divide-border">
                   {history.map((item: any) => (
                     <div 
                        key={item.id} 
                        className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => {
                          setSelectedInsight(item as any as AIPastoralInsightOutput);
                          const currentTab = document.querySelector('[data-state="active"][role="tab"]');
                          if (currentTab) {
                             (document.querySelector('[value="current"]') as HTMLElement)?.click();
                          }
                        }}
                     >
                       <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                             <Calendar className="h-5 w-5" />
                          </div>
                          <div>
                             <p className="font-bold text-foreground">
                               {item.createdAt?.toDate ? format(item.createdAt.toDate(), 'MMMM d, yyyy • HH:mm') : 'Recently Generated'}
                             </p>
                             <p className="text-xs text-muted-foreground line-clamp-1 max-w-xl">
                               {item.summaryInsight}
                             </p>
                          </div>
                       </div>
                       <Button variant="ghost" size="icon" className="rounded-xl group-hover:translate-x-1 transition-transform">
                          <ArrowRight className="h-4 w-4 text-primary" />
                       </Button>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="py-24 text-center space-y-4 opacity-40">
                   <History className="w-16 h-16 mx-auto mb-4" />
                   <p className="text-sm font-medium">No archived insights found.</p>
                   <p className="text-xs text-muted-foreground">Archive is automatically populated after running analysis.</p>
                 </div>
               )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
